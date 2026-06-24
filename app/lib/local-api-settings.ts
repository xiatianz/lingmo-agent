"use client";

export interface LocalApiSettings {
  providerLabel: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  enabled: boolean;
}

export const DEFAULT_LOCAL_API_SETTINGS: LocalApiSettings = {
  providerLabel: "OpenAI Compatible",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  apiKey: "",
  enabled: false,
};

const STORAGE_KEY = "lingmo.localApiSettings.v1";

function normalizeSettings(value: Partial<LocalApiSettings> | null): LocalApiSettings {
  return {
    ...DEFAULT_LOCAL_API_SETTINGS,
    ...(value ?? {}),
    providerLabel: value?.providerLabel?.trim() || DEFAULT_LOCAL_API_SETTINGS.providerLabel,
    baseUrl: value?.baseUrl?.trim() || DEFAULT_LOCAL_API_SETTINGS.baseUrl,
    model: value?.model?.trim() || DEFAULT_LOCAL_API_SETTINGS.model,
    apiKey: value?.apiKey?.trim() || "",
    enabled: Boolean(value?.enabled && value?.apiKey?.trim() && value?.model?.trim()),
  };
}

export function readLocalApiSettings(): LocalApiSettings {
  if (typeof window === "undefined") return DEFAULT_LOCAL_API_SETTINGS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LOCAL_API_SETTINGS;
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_LOCAL_API_SETTINGS;
  }
}

export function writeLocalApiSettings(settings: LocalApiSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
  window.dispatchEvent(new Event("lingmo-local-api-settings-change"));
}

export function clearLocalApiSettings() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("lingmo-local-api-settings-change"));
}

export function isLocalApiEnabled(settings = readLocalApiSettings()) {
  return Boolean(settings.enabled && settings.apiKey.trim() && settings.baseUrl.trim() && settings.model.trim());
}

export function getLocalApiHeaders(settings = readLocalApiSettings()): Record<string, string> {
  if (!isLocalApiEnabled(settings)) return {};
  return {
    "x-lingmo-api-key": settings.apiKey.trim(),
    "x-lingmo-base-url": settings.baseUrl.trim(),
    "x-lingmo-model": settings.model.trim(),
  };
}
