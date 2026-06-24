/**
 * Keyword Suggestion Agent
 * Given a topic, suggests relevant SEO keywords via LLM.
 */
import { HumanMessage } from '@langchain/core/messages';
import { createModel, createLogger, enforceDailyQuota, recordTokenUsage, resolveModelEnv } from './_shared';

const logger = createLogger('suggest-keywords');

const SYSTEM_PROMPT = `You are an SEO keyword expert. Given an article topic, suggest 3-5 highly relevant keywords or short phrases for SEO optimization.

RULES:
- Output ONLY the keywords separated by commas (e.g., "keyword1, keyword2, keyword3")
- Use the same language as the topic
- Keywords should be specific and relevant to the topic
- Include a mix of broad and long-tail keywords
- Do NOT output any explanation, numbering, or extra text`;

export async function onRequest(context: any) {
    const { request, env, conversation_id: conversationId } = context;
    const { topic } = request?.body ?? {};

    if (!topic?.trim()) {
        return new Response(JSON.stringify({ error: 'Missing topic' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        });
    }

    try {
        const modelConfig = await resolveModelEnv(context);
        const quotaResponse = await enforceDailyQuota(context, modelConfig);
        if (quotaResponse) return quotaResponse;
        const model = await createModel(modelConfig.env, { timeout: 30_000 });

        logger.log(`Suggesting keywords for: "${topic}" (conversation: ${conversationId || 'none'})`);

        const response = await model.invoke([
            { role: 'system', content: SYSTEM_PROMPT },
            new HumanMessage(`Topic: "${topic}"`),
        ]);

        const rawContent = (response as any).content;
        const text = typeof rawContent === 'string'
            ? rawContent
            : Array.isArray(rawContent)
                ? rawContent.map((c: any) => typeof c === 'string' ? c : c.text || '').join('')
                : String(rawContent || '');

        const keywords = text.replace(/^["']|["']$/g, '').trim();
        logger.log(`Suggested: "${keywords}"`);

        const usage = (response as any).usage_metadata || (response as any).response_metadata?.usage || {};
        await recordTokenUsage(
            context,
            modelConfig,
            usage.input_tokens || usage.prompt_tokens || 0,
            usage.output_tokens || usage.completion_tokens || 0
        );

        return new Response(JSON.stringify({ keywords }), {
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
