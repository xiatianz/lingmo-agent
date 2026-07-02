/**
 * Image Generation Agent
 * Generates an image using the configured image model, with Pollinations AI as local/demo fallback.
 */
import { HumanMessage } from '@langchain/core/messages';
import tcb from '@cloudbase/node-sdk';
import { createModel, createLogger, enforceDailyQuota, recordTokenUsage, resolveModelEnv } from './_shared';

const logger = createLogger('generate-image');

const OPTIMIZER_PROMPT = `You are a professional AI image generation prompt engineer.
Your task is to expand the user's short input prompt into a highly detailed, descriptive, and artistic prompt in English for Stable Diffusion/Flux.

RULES:
- Focus on subject, composition, camera shot, lighting, color palette, and atmosphere.
- Keep the output concise and effective (around 40-70 words).
- Output ONLY the optimized prompt text in English.
- Do NOT output any preamble, markdown formatting, quotes, or meta-explanations.`;

// Map aspect ratio to standard SDXL dimensions
function getDimensions(ratio: string): { width: number; height: number } {
    switch (ratio) {
        case '16:9': return { width: 1344, height: 768 };
        case '9:16': return { width: 768, height: 1344 };
        case '4:3': return { width: 1152, height: 864 };
        case '1:1':
        default:
            return { width: 1024, height: 1024 };
    }
}

function getImageApiSize(ratio: string): string {
    switch (ratio) {
        case '16:9': return '1792x1024';
        case '9:16': return '1024x1792';
        case '4:3': return '1792x1024';
        case '1:1':
        default:
            return '1024x1024';
    }
}

function getCloudBaseImageSize(ratio: string): string {
    switch (ratio) {
        case '16:9': return '1280x720';
        case '9:16': return '720x1280';
        case '4:3': return '1024x768';
        case '1:1':
        default:
            return '1024x1024';
    }
}

function getImageGenerationUrl(baseUrl: string): string {
    const trimmed = baseUrl.replace(/\/$/, '');
    if (/\/v1\/images\/generations$/i.test(trimmed)) return trimmed;
    if (/\/images\/generations$/i.test(trimmed)) return trimmed;
    if (/\/v1\/chat\/completions$/i.test(trimmed)) {
        return trimmed.replace(/\/v1\/chat\/completions$/i, '/v1/images/generations');
    }
    if (/\/chat\/completions$/i.test(trimmed)) {
        return trimmed.replace(/\/chat\/completions$/i, '/images/generations');
    }
    if (/\/v1$/i.test(trimmed)) return `${trimmed}/images/generations`;
    return `${trimmed}/v1/images/generations`;
}

function normalizeImageResponse(data: any): string {
    const item = data?.data?.[0] ?? data?.images?.[0] ?? data?.output?.[0];
    const url = item?.url ?? item?.image_url ?? (typeof item === 'string' ? item : '');
    if (url) return url;

    const b64 = item?.b64_json ?? item?.base64 ?? data?.b64_json ?? data?.image_base64;
    if (b64) return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;

    return '';
}

function normalizeCloudBaseImageResponse(result: any): { url: string; prompt?: string } {
    const payload = result?.result ?? result;
    const success = payload?.success;
    const url = payload?.imageUrl ?? payload?.image_url ?? payload?.url ?? payload?.data?.imageUrl ?? payload?.data?.url ?? '';

    if (success === false) {
        const code = payload?.code ? `${payload.code}: ` : '';
        throw new Error(`CloudBase image generation failed: ${code}${payload?.message || 'Unknown error'}`);
    }

    if (!url) {
        throw new Error('CloudBase image generation response missing imageUrl');
    }

    return {
        url,
        prompt: payload?.revised_prompt ?? payload?.revisedPrompt ?? payload?.prompt,
    };
}

function getCloudBaseConfig(env: any) {
    const envId = env.CLOUDBASE_ENV_ID?.trim();
    const functionName = env.CLOUDBASE_IMAGE_FUNCTION_NAME?.trim();
    const accessKey = env.CLOUDBASE_ACCESS_KEY?.trim();
    const secretId = env.CLOUDBASE_SECRET_ID?.trim();
    const secretKey = env.CLOUDBASE_SECRET_KEY?.trim();

    if (!envId) throw new Error('Missing environment variable: CLOUDBASE_ENV_ID');
    if (!functionName) throw new Error('Missing environment variable: CLOUDBASE_IMAGE_FUNCTION_NAME');
    if (!accessKey && !(secretId && secretKey)) {
        throw new Error('Missing CloudBase credentials: set CLOUDBASE_ACCESS_KEY or CLOUDBASE_SECRET_ID/CLOUDBASE_SECRET_KEY');
    }

    return {
        envId,
        functionName,
        region: env.CLOUDBASE_REGION?.trim(),
        accessKey,
        secretId,
        secretKey,
    };
}

async function generateImageWithCloudBase(env: any, payload: {
    prompt: string;
    rawPrompt: string;
    aspectRatio: string;
    style: string;
    seed?: number;
    size: string;
    model?: string;
}) {
    const config = getCloudBaseConfig(env);
    const app = tcb.init({
        env: config.envId,
        region: config.region,
        accessKey: config.accessKey,
        secretId: config.secretId,
        secretKey: config.secretKey,
    });

    logger.log(`Using CloudBase image function "${config.functionName}" in env "${config.envId}" with model "${payload.model || "default (hunyuan-image)"}"`);
    const res = await app.callFunction({
        name: config.functionName,
        data: {
            prompt: payload.prompt,
            rawPrompt: payload.rawPrompt,
            aspectRatio: payload.aspectRatio,
            style: payload.style,
            seed: payload.seed,
            size: payload.size,
            model: payload.model,
        },
    });

    return normalizeCloudBaseImageResponse(res.result);
}

export async function onRequest(context: any) {
    const { request, env, conversation_id: conversationId } = context;
    const { prompt, aspectRatio = '1:1', style = 'default', seed, optimize = true } = request?.body ?? {};

    if (!prompt?.trim()) {
        return new Response(JSON.stringify({ error: 'Missing prompt' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        });
    }

    try {
        const modelConfig = await resolveModelEnv(context);
        const quotaResponse = await enforceDailyQuota(context, modelConfig);
        if (quotaResponse) return quotaResponse;

        logger.log(`Received request: "${prompt}" (ratio: ${aspectRatio}, style: ${style}, optimize: ${optimize})`);

        // Step 1: Optimize prompt using LLM if requested
        let finalPrompt = prompt.trim();
        let promptOptimizerUsed = false;

        if (optimize) {
            try {
                const model = await createModel(modelConfig.env, { timeout: 30_000 });
                let styleInstruction = '';
                if (style !== 'default') {
                    styleInstruction = ` The artistic style must be strictly: ${style}.`;
                }

                const response = await model.invoke([
                    { role: 'system', content: OPTIMIZER_PROMPT + styleInstruction },
                    new HumanMessage(`Concept: "${prompt}"`),
                ]);

                const rawContent = (response as any).content;
                const text = typeof rawContent === 'string'
                    ? rawContent
                    : Array.isArray(rawContent)
                        ? rawContent.map((c: any) => typeof c === 'string' ? c : c.text || '').join('')
                        : String(rawContent || '');

                const cleanedText = text.replace(/^["']|["']$/g, '').trim();
                if (cleanedText) {
                    finalPrompt = cleanedText;
                    promptOptimizerUsed = true;
                    logger.log(`Optimized prompt to: "${finalPrompt}"`);
                }

                // Record token usage for the LLM prompt expansion call
                const usage = (response as any).usage_metadata || (response as any).response_metadata?.usage || {};
                await recordTokenUsage(
                    context,
                    modelConfig,
                    usage.input_tokens || usage.prompt_tokens || 0,
                    usage.output_tokens || usage.completion_tokens || 0
                );
            } catch (err) {
                logger.error('Prompt optimizer failed, using raw prompt:', (err as Error).message);
            }
        }

        const { width, height } = getDimensions(aspectRatio);
        let imageUrl = '';

        // Step 2: Generate image
        const imageProvider = modelConfig.env.AI_IMAGE_PROVIDER?.trim().toLowerCase();
        const configuredImageModel = modelConfig.env.AI_GATEWAY_IMAGE_MODEL?.trim();
        const imageApiKey = modelConfig.env.AI_GATEWAY_IMAGE_API_KEY?.trim() || modelConfig.env.AI_GATEWAY_API_KEY;
        const imageBaseUrl = modelConfig.env.AI_GATEWAY_IMAGE_BASE_URL?.trim() || modelConfig.env.AI_GATEWAY_BASE_URL;

        if (imageProvider === 'cloudbase') {
            const result = await generateImageWithCloudBase(modelConfig.env, {
                prompt: finalPrompt,
                rawPrompt: prompt,
                aspectRatio,
                style,
                seed,
                size: getCloudBaseImageSize(aspectRatio),
                model: configuredImageModel,
            });
            imageUrl = result.url;
            if (result.prompt) finalPrompt = result.prompt;
        } else if ((modelConfig.usingUserKey || configuredImageModel) && imageApiKey && imageBaseUrl) {
            const targetUrl = getImageGenerationUrl(imageBaseUrl);
            const modelName = configuredImageModel || 'dall-e-3';

            logger.log(`Using image model "${modelName}" at ${targetUrl}`);
            const res = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${imageApiKey}`,
                },
                body: JSON.stringify({
                    model: modelName,
                    prompt: finalPrompt,
                    n: 1,
                    size: getImageApiSize(aspectRatio),
                    quality: 'standard',
                }),
            });

            if (!res.ok) {
                const errBody = await res.text();
                const hint = res.status === 404
                    ? ' 请确认生图 Base URL 是 9Router API 地址，例如 https://your-9router-domain/v1 或 https://your-9router-domain/v1/images/generations，而不是控制台网页地址。'
                    : res.status === 400 && /does not support image generation/i.test(errBody)
                        ? ' 请确认生图模型来自 9Router 的 /v1/models/image，且该 Image Combo 没有路由到只支持聊天的 provider。'
                    : '';
                throw new Error(`Image generation failed (${res.status}): ${errBody.slice(0, 500)}${hint}`);
            }

            const data = await res.json();
            imageUrl = normalizeImageResponse(data);
            if (!imageUrl) {
                throw new Error('Image generation response missing image URL');
            }
        } else {
            // Default Platform: Use Pollinations AI (free, fast, high quality Stable Diffusion/Flux)
            const randomSeed = seed ?? Math.floor(Math.random() * 1000000);
            
            // Build pollination prompt with style keyword if style isn't default and optimizer wasn't run
            let pollinationPrompt = finalPrompt;
            if (!promptOptimizerUsed && style !== 'default') {
                pollinationPrompt = `${finalPrompt}, in the style of ${style}`;
            }

            const encodedPrompt = encodeURIComponent(pollinationPrompt);
            // Pollinations AI API format: https://image.pollinations.ai/p/{prompt}?width={w}&height={h}&seed={seed}&nologo=true
            imageUrl = `https://image.pollinations.ai/p/${encodedPrompt}?width=${width}&height=${height}&seed=${randomSeed}&nologo=true`;
            logger.log(`Using platform default pollinations.ai: ${imageUrl}`);
        }

        return new Response(JSON.stringify({
            url: imageUrl,
            prompt: finalPrompt,
            rawPrompt: prompt,
            aspectRatio,
            style,
            width,
            height
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        });

    } catch (e) {
        const msg = (e as Error).message;
        logger.error(msg);
        return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        });
    }
}
