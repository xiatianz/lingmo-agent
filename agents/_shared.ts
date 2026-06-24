/**
 * Shared utilities for all agent endpoints.
 * Centralizes model initialization, environment config, and SSE helpers.
 */
import { initChatModel } from 'langchain';
import {
    decryptApiKey,
    getAuthenticatedUser,
    getStoredModelKey,
    getSupabaseAdmin,
    isSupabaseServerConfigured,
    upsertProfile,
} from '../lib/server/supabase-admin';

type Model = Awaited<ReturnType<typeof initChatModel>>;

const DEFAULT_MODEL = '@makers/deepseek-v4-flash';

export interface AgentEnv {
    AI_GATEWAY_API_KEY: string;
    AI_GATEWAY_BASE_URL: string;
    AI_GATEWAY_MODEL?: string;
}

interface AgentContextEnv extends Record<string, string | undefined> {
    BYOK_BYPASS_DAILY_LIMIT?: string;
    DEFAULT_DAILY_REQUEST_LIMIT?: string;
    DEFAULT_DAILY_TOKEN_LIMIT?: string;
    USER_KEY_ENCRYPTION_SECRET?: string;
}

export interface ModelResolution {
    env: AgentEnv;
    userId: string | null;
    usingUserKey: boolean;
}

/** Extract and validate required environment variables. */
export function getAgentEnv(contextEnv: Record<string, string | undefined> | undefined): AgentEnv {
    const source = contextEnv ?? {};
    const required = ['AI_GATEWAY_API_KEY', 'AI_GATEWAY_BASE_URL'] as const;
    const missing = required.filter((k) => !source[k]?.trim());
    if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    return {
        AI_GATEWAY_API_KEY: source.AI_GATEWAY_API_KEY!,
        AI_GATEWAY_BASE_URL: source.AI_GATEWAY_BASE_URL!,
        AI_GATEWAY_MODEL: source.AI_GATEWAY_MODEL,
    };
}

/** Initialize a chat model. Caches per base URL to avoid re-initialization. */
const modelCache = new Map<string, Model>();

async function fingerprintSecret(secret: string) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
    return Array.from(new Uint8Array(digest))
        .slice(0, 12)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

export async function createModel(env: AgentEnv, options?: { timeout?: number }): Promise<Model> {
    const modelName = env.AI_GATEWAY_MODEL || DEFAULT_MODEL;
    const cacheKey = `${modelName}:${env.AI_GATEWAY_BASE_URL}:${await fingerprintSecret(env.AI_GATEWAY_API_KEY)}`;

    if (modelCache.has(cacheKey)) {
        return modelCache.get(cacheKey)!;
    }

    const model = await initChatModel(modelName, {
        modelProvider: 'openai',
        apiKey: env.AI_GATEWAY_API_KEY,
        configuration: {
            baseURL: env.AI_GATEWAY_BASE_URL,
        },
        timeout: options?.timeout ?? 300_000,
    });

    modelCache.set(cacheKey, model);
    return model;
}

function boolFromEnv(value: string | undefined, fallback: boolean) {
    if (value === undefined) return fallback;
    return value === 'true' || value === '1';
}

function numberFromEnv(value: string | undefined, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function jsonError(message: string, status: number) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
}

function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

export async function resolveModelEnv(context: any): Promise<ModelResolution> {
    const contextEnv = (context?.env ?? {}) as AgentContextEnv;
    const platformEnv = getAgentEnv(contextEnv);

    if (!isSupabaseServerConfigured(contextEnv)) {
        return { env: platformEnv, userId: null, usingUserKey: false };
    }

    const user = await getAuthenticatedUser(contextEnv, context?.request);
    if (!user) {
        return { env: platformEnv, userId: null, usingUserKey: false };
    }

    await upsertProfile(contextEnv, user);

    const storedKey = await getStoredModelKey(contextEnv, user.id);
    if (!storedKey) {
        return { env: platformEnv, userId: user.id, usingUserKey: false };
    }

    if (!contextEnv.USER_KEY_ENCRYPTION_SECRET) {
        throw new Error('Missing USER_KEY_ENCRYPTION_SECRET');
    }

    const apiKey = await decryptApiKey(storedKey.encrypted_api_key, contextEnv.USER_KEY_ENCRYPTION_SECRET);

    return {
        env: {
            AI_GATEWAY_API_KEY: apiKey,
            AI_GATEWAY_BASE_URL: storedKey.base_url,
            AI_GATEWAY_MODEL: storedKey.model,
        },
        userId: user.id,
        usingUserKey: true,
    };
}

export async function enforceDailyQuota(context: any, resolution: ModelResolution): Promise<Response | null> {
    const contextEnv = (context?.env ?? {}) as AgentContextEnv;
    if (!resolution.userId || !isSupabaseServerConfigured(contextEnv)) return null;

    const byokBypass = boolFromEnv(contextEnv.BYOK_BYPASS_DAILY_LIMIT, true);
    if (resolution.usingUserKey && byokBypass) return null;

    const supabase = getSupabaseAdmin(contextEnv);
    const { data: limitRow, error: limitError } = await supabase
        .schema('private')
        .from('user_limits')
        .select('daily_request_limit, daily_token_limit, byok_bypass_limit')
        .eq('user_id', resolution.userId)
        .maybeSingle();
    if (limitError) throw limitError;

    const userByokBypass = limitRow?.byok_bypass_limit;
    if (resolution.usingUserKey && (userByokBypass ?? byokBypass)) return null;

    const requestLimit = Number(limitRow?.daily_request_limit) || numberFromEnv(contextEnv.DEFAULT_DAILY_REQUEST_LIMIT, 0);
    const tokenLimit = Number(limitRow?.daily_token_limit) || numberFromEnv(contextEnv.DEFAULT_DAILY_TOKEN_LIMIT, 0);
    if (!requestLimit && !tokenLimit) return null;

    const usageDate = todayIsoDate();
    const { data: usageRow, error: usageError } = await supabase
        .schema('private')
        .from('usage_daily')
        .select('request_count, input_tokens, output_tokens')
        .eq('user_id', resolution.userId)
        .eq('usage_date', usageDate)
        .maybeSingle();
    if (usageError) throw usageError;

    const requestCount = Number(usageRow?.request_count ?? 0);
    const usedTokens = Number(usageRow?.input_tokens ?? 0) + Number(usageRow?.output_tokens ?? 0);

    if (requestLimit && requestCount >= requestLimit) {
        return jsonError('Daily request quota exceeded', 429);
    }
    if (tokenLimit && usedTokens >= tokenLimit) {
        return jsonError('Daily token quota exceeded', 429);
    }

    const { error: upsertError } = await supabase.schema('private').from('usage_daily').upsert({
        user_id: resolution.userId,
        usage_date: usageDate,
        request_count: requestCount + 1,
        input_tokens: Number(usageRow?.input_tokens ?? 0),
        output_tokens: Number(usageRow?.output_tokens ?? 0),
    });
    if (upsertError) throw upsertError;

    return null;
}

export async function recordTokenUsage(
    context: any,
    resolution: ModelResolution,
    inputTokens: number,
    outputTokens: number
) {
    const contextEnv = (context?.env ?? {}) as AgentContextEnv;
    if (!resolution.userId || !isSupabaseServerConfigured(contextEnv)) return;

    const supabase = getSupabaseAdmin(contextEnv);
    const usageDate = todayIsoDate();
    const { data: usageRow, error: usageError } = await supabase
        .schema('private')
        .from('usage_daily')
        .select('request_count, input_tokens, output_tokens')
        .eq('user_id', resolution.userId)
        .eq('usage_date', usageDate)
        .maybeSingle();
    if (usageError) throw usageError;

    const { error } = await supabase.schema('private').from('usage_daily').upsert({
        user_id: resolution.userId,
        usage_date: usageDate,
        request_count: Number(usageRow?.request_count ?? 1),
        input_tokens: Number(usageRow?.input_tokens ?? 0) + Math.max(0, inputTokens || 0),
        output_tokens: Number(usageRow?.output_tokens ?? 0) + Math.max(0, outputTokens || 0),
    });
    if (error) throw error;
}

/** Create a logger with a consistent prefix. */
export function createLogger(name: string) {
    return {
        log(...args: unknown[]) { console.log(`[${name}]`, ...args); },
        error(...args: unknown[]) { console.error(`[${name}]`, ...args); },
    };
}

// ─── SSE Helpers ───
// SOP D 段要求："Use the shared createSSEResponse helper instead of inlining a
// ReadableStream per file"。所有 agent 端点统一走这个 helper。

export function sseEvent(data: Record<string, unknown>): string {
    return `data: ${JSON.stringify(data)}\n\n`;
}

export function createSSEResponse(
    generator: AsyncGenerator<string> | ((signal?: AbortSignal) => AsyncGenerator<string>),
    signal?: AbortSignal
): Response {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
        async start(controller) {
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(sseEvent({ type: 'ping', ts: Date.now() })));
                } catch {}
            }, 5_000);
            try {
                const it = typeof generator === 'function' ? generator(signal) : generator;
                for await (const chunk of it) {
                    if (signal?.aborted) break;
                    controller.enqueue(encoder.encode(chunk));
                }
            } catch (e) {
                const error = e as Error;
                if (error.name !== 'AbortError' && !signal?.aborted) {
                    controller.enqueue(encoder.encode(sseEvent({ type: 'error_message', content: error.message })));
                }
            } finally {
                clearInterval(heartbeat);
                controller.close();
            }
        },
        cancel() {},
    });

    return new Response(readable, {
        status: 200,
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
