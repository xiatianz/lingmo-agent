/**
 * Image Generation Agent
 * Generates an image using BYOK (DALL-E 3) or Platform default (Pollinations AI + LLM Prompt Optimizer).
 */
import { HumanMessage } from '@langchain/core/messages';
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
        // If the user has a custom OpenAI API Key, use DALL-E 3 (or whatever model config is passed)
        if (modelConfig.usingUserKey && modelConfig.env.AI_GATEWAY_API_KEY) {
            const apiBaseUrl = modelConfig.env.AI_GATEWAY_BASE_URL.replace(/\/chat\/completions$/, '').replace(/\/$/, '');
            const targetUrl = `${apiBaseUrl}/images/generations`;
            const modelName = modelConfig.env.AI_GATEWAY_IMAGE_MODEL || 'dall-e-3';

            logger.log(`Using BYOK to generate image via DALL-E at ${targetUrl}`);
            const res = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${modelConfig.env.AI_GATEWAY_API_KEY}`,
                },
                body: JSON.stringify({
                    model: modelName,
                    prompt: finalPrompt,
                    n: 1,
                    size: aspectRatio === '1:1' ? '1024x1024' : (aspectRatio === '16:9' ? '1792x1024' : '1024x1792'),
                    quality: 'standard',
                }),
            });

            if (!res.ok) {
                const errBody = await res.text();
                throw new Error(`DALL-E Generation failed (${res.status}): ${errBody}`);
            }

            const data = await res.json();
            imageUrl = data?.data?.[0]?.url;
            if (!imageUrl) {
                throw new Error('DALL-E response missing image URL');
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
