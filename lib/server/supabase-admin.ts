import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

interface ServerEnv {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  USER_KEY_ENCRYPTION_SECRET?: string;
}

interface StoredModelKey {
  provider_label: string;
  base_url: string;
  model: string;
  encrypted_api_key: string;
  enabled: boolean;
}

function getSupabaseUrl(env: ServerEnv) {
  return env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
}

function getSupabaseSecretKey(env: ServerEnv) {
  return env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
}

export function isSupabaseServerConfigured(env: ServerEnv) {
  return Boolean(getSupabaseUrl(env) && getSupabaseSecretKey(env));
}

export function getSupabaseAdmin(env: ServerEnv): SupabaseClient {
  const url = getSupabaseUrl(env);
  const key = getSupabaseSecretKey(env);

  if (!url || !key) {
    throw new Error("Supabase server config is missing");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getBearerToken(request: any): string | null {
  const headers = request?.headers;
  const value =
    typeof headers?.get === "function"
      ? headers.get("authorization")
      : headers?.authorization || headers?.Authorization;

  if (!value || typeof value !== "string") return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function getAuthenticatedUser(env: ServerEnv, request: any): Promise<User | null> {
  if (!isSupabaseServerConfigured(env)) return null;

  const token = getBearerToken(request);
  if (!token) return null;

  const supabase = getSupabaseAdmin(env);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return data.user;
}

export async function upsertProfile(env: ServerEnv, user: User) {
  const supabase = getSupabaseAdmin(env);
  const githubIdentity = user.identities?.find((identity) => identity.provider === "github");
  const githubUsername =
    (githubIdentity?.identity_data?.user_name as string | undefined) ||
    (githubIdentity?.identity_data?.preferred_username as string | undefined) ||
    null;

  await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email,
    github_username: githubUsername,
  });
}

function base64Encode(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function base64Decode(value: string) {
  return new Uint8Array(Buffer.from(value, "base64"));
}

async function getAesKey(secret: string) {
  if (secret.length < 32) {
    throw new Error("USER_KEY_ENCRYPTION_SECRET must be at least 32 characters");
  }

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptApiKey(apiKey: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getAesKey(secret);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(apiKey)
  );

  return `v1:${base64Encode(iv)}:${base64Encode(new Uint8Array(encrypted))}`;
}

export async function decryptApiKey(encryptedApiKey: string, secret: string) {
  const [version, iv, encrypted] = encryptedApiKey.split(":");
  if (version !== "v1" || !iv || !encrypted) {
    throw new Error("Unsupported encrypted API key format");
  }

  const key = await getAesKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64Decode(iv) },
    key,
    base64Decode(encrypted)
  );

  return new TextDecoder().decode(decrypted);
}

export async function getStoredModelKey(env: ServerEnv, userId: string): Promise<StoredModelKey | null> {
  if (!isSupabaseServerConfigured(env)) return null;

  const supabase = getSupabaseAdmin(env);
  const { data, error } = await supabase
    .schema("private")
    .from("user_model_keys")
    .select("provider_label, base_url, model, encrypted_api_key, enabled")
    .eq("user_id", userId)
    .eq("enabled", true)
    .maybeSingle();

  if (error) throw error;
  return data as StoredModelKey | null;
}
