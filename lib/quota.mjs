const DEFAULT_DAILY_REQUEST_LIMIT = 20;
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

function headerValue(request, name) {
  const headers = request?.headers;
  if (!headers) return null;
  if (typeof headers.get === "function") return headers.get(name);
  return headers[name] ?? headers[name.toLowerCase()] ?? null;
}

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBaseUrl(value) {
  const trimmed = trimString(value);
  if (!trimmed) return "";
  try {
    return new URL(trimmed).toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function todayIsoDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function quotaDateKey(now = new Date()) {
  return todayIsoDate(now).replaceAll("-", "");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getKv(env = {}) {
  return env.LINGMO_USAGE_KV || env.USAGE_KV || env.usageKv || null;
}

export function getDailyRequestLimit(env = {}) {
  const parsed = Number(env.DEFAULT_DAILY_REQUEST_LIMIT);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_DAILY_REQUEST_LIMIT;
}

export function parseRequestModelConfig(request) {
  const apiKey =
    trimString(headerValue(request, "x-lingmo-api-key")) ||
    trimString(request?.body?.modelConfig?.apiKey);
  const baseUrl =
    normalizeBaseUrl(headerValue(request, "x-lingmo-base-url")) ||
    normalizeBaseUrl(request?.body?.modelConfig?.baseUrl) ||
    DEFAULT_BASE_URL;
  const model =
    trimString(headerValue(request, "x-lingmo-model")) ||
    trimString(request?.body?.modelConfig?.model);

  if (!apiKey || !baseUrl || !model) return null;
  return { apiKey, baseUrl, model };
}

export function getClientIp(request) {
  const candidates = [
    headerValue(request, "eo-client-ip"),
    headerValue(request, "cf-connecting-ip"),
    headerValue(request, "x-real-ip"),
    headerValue(request, "x-forwarded-for"),
    headerValue(request, "forwarded"),
  ];

  for (const candidate of candidates) {
    const value = trimString(candidate);
    if (!value) continue;
    if (value.toLowerCase().startsWith("for=")) {
      return value.slice(4).split(";")[0].replace(/^"|"$/g, "").trim();
    }
    return value.split(",")[0].trim();
  }

  return "unknown";
}

export async function getQuotaKey(request, now = new Date()) {
  const ipHash = (await sha256Hex(getClientIp(request))).slice(0, 32);
  return `usage_${quotaDateKey(now)}_${ipHash}`;
}

function parseUsageRecord(raw, date, limit) {
  if (!raw) return { date, count: 0, limit, updatedAt: null };
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed?.date !== date) return { date, count: 0, limit, updatedAt: null };
    return {
      date,
      count: Math.max(0, Number(parsed.count) || 0),
      limit: Number(parsed.limit) > 0 ? Number(parsed.limit) : limit,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch {
    return { date, count: 0, limit, updatedAt: null };
  }
}

function quotaError(count, limit) {
  return new Response(JSON.stringify({
    error: "Daily request quota exceeded",
    usage: { count, limit },
  }), {
    status: 429,
    headers: { "Content-Type": "application/json; charset=UTF-8" },
  });
}

export async function getPlatformUsageStatus(context, options = {}) {
  const request = context?.request;
  const env = context?.env ?? {};
  const kv = getKv(env);
  const limit = getDailyRequestLimit(env);
  const now = options.now ?? new Date();
  const date = todayIsoDate(now);

  if (!kv) {
    return { configured: false, date, count: 0, limit };
  }

  const key = await getQuotaKey(request, now);
  const record = parseUsageRecord(await kv.get(key), date, limit);
  return { configured: true, key, date, count: record.count, limit };
}

export async function enforcePlatformDailyQuota(context, options = {}) {
  const request = context?.request;
  const env = context?.env ?? {};
  const kv = getKv(env);
  const limit = getDailyRequestLimit(env);
  const now = options.now ?? new Date();
  const date = todayIsoDate(now);

  if (!kv) {
    return { allowed: true, configured: false, date, count: 0, limit };
  }

  const key = await getQuotaKey(request, now);
  const record = parseUsageRecord(await kv.get(key), date, limit);
  if (record.count >= limit) {
    return {
      allowed: false,
      configured: true,
      date,
      key,
      count: record.count,
      limit,
      response: quotaError(record.count, limit),
    };
  }

  const next = {
    date,
    count: record.count + 1,
    limit,
    updatedAt: now.toISOString(),
  };
  await kv.put(key, JSON.stringify(next));

  return {
    allowed: true,
    configured: true,
    date,
    key,
    count: next.count,
    limit,
  };
}
