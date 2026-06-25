/**
 * Shared utilities for all agent endpoints.
 * Centralizes model initialization, environment config, and SSE helpers.
 */
import { initChatModel } from 'langchain';
import { enforcePlatformDailyQuota, isQuotaCheckedRequest, parseRequestModelConfig } from '../lib/quota.mjs';

type Model = Awaited<ReturnType<typeof initChatModel>>;

const DEFAULT_MODEL = '@makers/deepseek-v4-flash';

export interface AgentEnv {
    AI_GATEWAY_API_KEY: string;
    AI_GATEWAY_BASE_URL: string;
    AI_GATEWAY_MODEL?: string;
}

interface AgentContextEnv extends Record<string, string | undefined> {
    DEFAULT_DAILY_REQUEST_LIMIT?: string;
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

function jsonError(message: string, status: number) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
}

export async function resolveModelEnv(context: any): Promise<ModelResolution> {
    const contextEnv = (context?.env ?? {}) as AgentContextEnv;
    const requestConfig = parseRequestModelConfig(context?.request);

    if (requestConfig) {
        return {
            env: {
                AI_GATEWAY_API_KEY: requestConfig.apiKey,
                AI_GATEWAY_BASE_URL: requestConfig.baseUrl,
                AI_GATEWAY_MODEL: requestConfig.model,
            },
            userId: null,
            usingUserKey: true,
        };
    }

    return { env: getAgentEnv(contextEnv), userId: null, usingUserKey: false };
}

export async function enforceDailyQuota(context: any, resolution: ModelResolution): Promise<Response | null> {
    if (resolution.usingUserKey) return null;
    if (isQuotaCheckedRequest(context?.request)) return null;

    const quota = await enforcePlatformDailyQuota(context);
    if (!quota.allowed) return quota.response ?? jsonError('Daily request quota exceeded', 429);
    return null;
}

export async function recordTokenUsage(
    context: any,
    resolution: ModelResolution,
    inputTokens: number,
    outputTokens: number
) {
    void context;
    void resolution;
    void inputTokens;
    void outputTokens;
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

export function normalizeToolArgsForInvoke(args: unknown): unknown {
    if (!args || typeof args !== 'object' || Array.isArray(args)) return args;

    const normalized: Record<string, unknown> = { ...(args as Record<string, unknown>) };
    for (const key of ['maxResults', 'limit', 'topK', 'k']) {
        const value = normalized[key];
        if (typeof value === 'string' && value.trim()) {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) normalized[key] = parsed;
        }
    }
    return normalized;
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
