"use client";

import { createBrowserClient } from "@supabase/ssr";

function getSupabaseBrowserConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return url && key ? { url, key } : null;
}

export function isSupabaseBrowserConfigured() {
  return Boolean(getSupabaseBrowserConfig());
}

export function createSupabaseBrowserClient() {
  const config = getSupabaseBrowserConfig();
  if (!config) {
    throw new Error("Supabase browser config is missing");
  }

  return createBrowserClient(config.url, config.key, {
    auth: {
      experimental: { passkey: true },
    },
  });
}

export async function getSupabaseAuthHeader(): Promise<Record<string, string>> {
  if (!isSupabaseBrowserConfigured()) return {};

  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  return token ? { Authorization: `Bearer ${token}` } : {};
}
