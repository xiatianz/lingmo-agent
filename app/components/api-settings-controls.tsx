"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  clearLocalApiSettings,
  DEFAULT_LOCAL_API_SETTINGS,
  getLocalApiHeaders,
  isLocalApiEnabled,
  readLocalApiSettings,
  type LocalApiSettings,
  writeLocalApiSettings,
} from "@/app/lib/local-api-settings";
import { cn } from "@/lib/utils";

interface UsageStatus {
  configured: boolean;
  date: string;
  count: number;
  limit: number;
  remaining?: number;
}

interface ApiSettingsControlsProps {
  refreshKey?: number;
}

export function ApiSettingsControls({ refreshKey = 0 }: ApiSettingsControlsProps) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<LocalApiSettings>(DEFAULT_LOCAL_API_SETTINGS);
  const [form, setForm] = useState<LocalApiSettings>(DEFAULT_LOCAL_API_SETTINGS);
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const localApiEnabled = isLocalApiEnabled(settings);

  const loadSettings = useCallback(() => {
    const next = readLocalApiSettings();
    setSettings(next);
    setForm(next);
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      const response = await fetch("/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getLocalApiHeaders() },
        body: JSON.stringify({}),
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data?.usage) setUsage(data.usage);
    } catch {}
  }, []);

  useEffect(() => {
    loadSettings();
    loadUsage();

    const onChange = () => {
      loadSettings();
      loadUsage();
    };
    window.addEventListener("lingmo-local-api-settings-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("lingmo-local-api-settings-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [loadSettings, loadUsage]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage, refreshKey]);

  const save = useCallback((event: FormEvent) => {
    event.preventDefault();
    const next = {
      ...form,
      providerLabel: form.providerLabel.trim() || DEFAULT_LOCAL_API_SETTINGS.providerLabel,
      baseUrl: form.baseUrl.trim() || DEFAULT_LOCAL_API_SETTINGS.baseUrl,
      model: form.model.trim(),
      imageBaseUrl: form.imageBaseUrl.trim(),
      imageModel: form.imageModel.trim() || DEFAULT_LOCAL_API_SETTINGS.imageModel,
      apiKey: form.apiKey.trim(),
      imageApiKey: form.imageApiKey.trim(),
      enabled: form.enabled,
    };

    if (next.enabled && (!next.apiKey || !next.baseUrl || !next.model)) {
      setStatus({ type: "error", text: "启用自有 API 前，请填写 Key、Base URL 和模型。" });
      return;
    }

    writeLocalApiSettings(next);
    setSettings(readLocalApiSettings());
    setStatus({ type: "success", text: "API 设置已保存到本机浏览器。" });
  }, [form]);

  const remove = useCallback(() => {
    clearLocalApiSettings();
    setSettings(DEFAULT_LOCAL_API_SETTINGS);
    setForm(DEFAULT_LOCAL_API_SETTINGS);
    setStatus({ type: "success", text: "已删除本地 API 设置。" });
  }, []);

  const usageLabel = usage ? `${usage.remaining ?? Math.max(0, usage.limit - usage.count)}/${usage.limit}` : "--/50";

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-medium shadow-sm transition",
          localApiEnabled
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
            : "border-white/70 bg-white/70 text-slate-700 hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
        )}
        title="API 设置"
        aria-expanded={open}
      >
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full",
            localApiEnabled ? "bg-emerald-100 dark:bg-emerald-900/60" : "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
          )}
        >
          {localApiEnabled ? <KeyIcon className="h-3.5 w-3.5" /> : <GaugeIcon className="h-3.5 w-3.5" />}
        </span>
        <span className="whitespace-nowrap">
          {localApiEnabled ? "自有 API" : `今日剩余 ${usageLabel}`}
        </span>
        <ChevronIcon className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[90] cursor-default bg-black/40 backdrop-blur-xs md:bg-transparent md:backdrop-blur-none"
            aria-label="关闭 API 设置"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed bottom-4 left-4 right-4 z-[100] max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-slate-950 md:absolute md:bottom-auto md:left-auto md:right-0 md:top-[calc(100%+0.5rem)] md:w-[380px] md:max-h-[85vh]"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">API 设置</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  自有 API Key 只保存在当前浏览器本地，不会上传保存；启用后不消耗每日平台额度。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
                aria-label="关闭"
              >
                ×
              </button>
            </div>

            <form onSubmit={save} className="space-y-3">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="font-medium text-slate-700 dark:text-slate-200">启用自有 API</span>
              </label>

              <Field label="Provider">
                <input
                  value={form.providerLabel}
                  onChange={(event) => setForm((prev) => ({ ...prev, providerLabel: event.target.value }))}
                  className={inputClassName}
                  placeholder="OpenAI Compatible"
                />
              </Field>
              <Field label="Base URL">
                <input
                  value={form.baseUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, baseUrl: event.target.value }))}
                  className={inputClassName}
                  placeholder="https://api.openai.com/v1"
                />
              </Field>
              <Field label="生图 Base URL (可选)">
                <input
                  value={form.imageBaseUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, imageBaseUrl: event.target.value }))}
                  className={inputClassName}
                  placeholder="例如 https://your-9router-domain/v1"
                />
              </Field>
              <Field label="文本模型 (Text Model)">
                <input
                  value={form.model}
                  onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
                  className={inputClassName}
                  placeholder="gpt-4o-mini"
                />
              </Field>
              <Field label="生图模型 (Image Model)">
                <input
                  value={form.imageModel}
                  onChange={(event) => setForm((prev) => ({ ...prev, imageModel: event.target.value }))}
                  className={inputClassName}
                  placeholder="例如 image 或 gemini/gemini-3-pro-image-preview"
                />
              </Field>
              <Field label="API Key">
                <input
                  value={form.apiKey}
                  onChange={(event) => setForm((prev) => ({ ...prev, apiKey: event.target.value }))}
                  className={inputClassName}
                  placeholder="sk-..."
                  type="password"
                  autoComplete="off"
                />
              </Field>
              <Field label="生图 API Key (可选)">
                <input
                  value={form.imageApiKey}
                  onChange={(event) => setForm((prev) => ({ ...prev, imageApiKey: event.target.value }))}
                  className={inputClassName}
                  placeholder="留空则使用上方 API Key"
                  type="password"
                  autoComplete="off"
                />
              </Field>


              {status && (
                <p className={cn("text-xs", status.type === "error" ? "text-red-600 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300")}>
                  {status.text}
                </p>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={remove}>
                  删除
                </Button>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    取消
                  </Button>
                  <Button type="submit">保存</Button>
                </div>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}

const inputClassName =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100";

function KeyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="M12 11l8-8" />
      <path d="M17 3h4v4" />
    </svg>
  );
}

function GaugeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 14a8 8 0 0 1 16 0" />
      <path d="M12 14l3-4" />
      <path d="M7 14h.01" />
      <path d="M17 14h.01" />
    </svg>
  );
}

function ChevronIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
