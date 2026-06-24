import {
  encryptApiKey,
  getAuthenticatedUser,
  getSupabaseAdmin,
  upsertProfile,
} from "../../lib/server/supabase-admin";
import { createLogger } from "../_logger";

const logger = createLogger("model-settings");

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8" },
  });
}

function normalizeBaseUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  return url.toString().replace(/\/$/, "");
}

export async function onRequestPost(context: any) {
  const env = context.env ?? {};
  const request = context.request;
  const body = request?.body ?? {};
  const action = body.action || "get";

  const user = await getAuthenticatedUser(env, request);
  if (!user) return json({ error: "Unauthorized" }, 401);

  if (!env.USER_KEY_ENCRYPTION_SECRET) {
    return json({ error: "Missing USER_KEY_ENCRYPTION_SECRET" }, 500);
  }

  const supabase = getSupabaseAdmin(env);
  await upsertProfile(env, user);

  try {
    if (action === "get") {
      const { data, error } = await supabase
        .schema("private")
        .from("user_model_keys")
        .select("provider_label, base_url, model, enabled, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return json({
        settings: data
          ? {
              hasKey: true,
              providerLabel: data.provider_label,
              baseUrl: data.base_url,
              model: data.model,
              enabled: data.enabled,
              updatedAt: data.updated_at,
            }
          : { hasKey: false },
      });
    }

    if (action === "save") {
      const baseUrl = normalizeBaseUrl(String(body.baseUrl || ""));
      const model = String(body.model || "").trim();
      const providerLabel = String(body.providerLabel || "OpenAI Compatible").trim();
      const apiKey = String(body.apiKey || "").trim();

      if (!baseUrl || !model) return json({ error: "Missing baseUrl or model" }, 400);

      const row: Record<string, unknown> = {
        user_id: user.id,
        provider_label: providerLabel || "OpenAI Compatible",
        base_url: baseUrl,
        model,
        enabled: true,
      };

      if (apiKey) {
        row.encrypted_api_key = await encryptApiKey(apiKey, env.USER_KEY_ENCRYPTION_SECRET);
      } else {
        const { data: existing, error } = await supabase
          .schema("private")
          .from("user_model_keys")
          .select("encrypted_api_key")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (!existing?.encrypted_api_key) return json({ error: "Missing apiKey" }, 400);
        row.encrypted_api_key = existing.encrypted_api_key;
      }

      const { error } = await supabase.schema("private").from("user_model_keys").upsert(row);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "delete") {
      const { error } = await supabase
        .schema("private")
        .from("user_model_keys")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(message);
    return json({ error: message }, 500);
  }
}
