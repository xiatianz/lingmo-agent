"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ImageParams {
  prompt: string;
  aspectRatio: string;
  style: string;
  seed?: number;
  optimize: boolean;
}

interface ImageFormProps {
  onGenerate: (params: ImageParams) => void;
  onStop: () => void;
  isGenerating: boolean;
}

const STYLE_PRESETS = [
  {
    id: "default",
    name: "默认智能",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.904-4.904L21 9.813l-4.904-4.904-6.283 6.283z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1M12 20v1M21 12h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707-.707" />
      </svg>
    ),
    styleText: ""
  },
  {
    id: "photorealistic",
    name: "写实摄影",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <circle cx="12" cy="13" r="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    styleText: "highly detailed photo, 8k resolution, photorealistic, dramatic lighting, professional photography"
  },
  {
    id: "anime",
    name: "二次元动漫",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
    styleText: "anime style, vibrant colors, detailed line art, masterpiece, studio ghibli aesthetic"
  },
  {
    id: "3d-render",
    name: "3D 立体",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14v4m0 0L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    styleText: "3D render, clay model style, octane render, soft shadows, cute toy style, pastel colors"
  },
  {
    id: "cyberpunk",
    name: "赛博朋克",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    styleText: "cyberpunk style, neon lights, night scene, detailed futuristic city, glowing holographic elements"
  },
  {
    id: "watercolor",
    name: "国风水墨",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707-.707" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8a4 4 0 100 8 4 4 0 000-8z" />
      </svg>
    ),
    styleText: "chinese ink brush painting, traditional chinese art style, elegant watercolor wash, high artistic value"
  },
];

const ASPECT_RATIOS = [
  { id: "1:1", label: "1:1 头像/社交", desc: "1024x1024", icon: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  )},
  { id: "16:9", label: "16:9 壁纸/横图", desc: "1344x768", icon: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
    </svg>
  )},
  { id: "9:16", label: "9:16 手机/竖图", desc: "768x1344", icon: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="6" y="3" width="12" height="18" rx="2" />
    </svg>
  )},
  { id: "4:3", label: "4:3 配图/经典", desc: "1152x864", icon: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
    </svg>
  )},
];

export function ImageForm({ onGenerate, onStop, isGenerating }: ImageFormProps) {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [style, setStyle] = useState("default");
  const [optimize, setOptimize] = useState(true);
  const [seed, setSeed] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim() || isGenerating) return;

      onGenerate({
        prompt: prompt.trim(),
        aspectRatio,
        style,
        seed: seed.trim() ? Number(seed) : undefined,
        optimize,
      });
    },
    [prompt, aspectRatio, style, seed, optimize, isGenerating, onGenerate]
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Prompt Input */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
            画面描述 (Prompt)
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="描述你想生成的画面，例如：一个穿着太空服在火星上喝咖啡的可爱猫咪，写实风格，阳光明媚"
            rows={3}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-300 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:bg-slate-900"
            disabled={isGenerating}
          />
        </div>

        {/* Aspect Ratio */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
            画幅比例
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ASPECT_RATIOS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setAspectRatio(item.id)}
                disabled={isGenerating}
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-2 text-left transition hover:bg-slate-50 dark:hover:bg-white/5",
                  aspectRatio === item.id
                    ? "border-brand-500 bg-brand-50/50 text-brand-700 dark:border-brand-400 dark:bg-brand-950/20 dark:text-brand-300"
                    : "border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400"
                )}
              >
                <span className={cn(
                  "flex-shrink-0",
                  aspectRatio === item.id ? "text-brand-600 dark:text-brand-400" : "text-slate-400"
                )}>
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-medium leading-none">{item.label}</div>
                  <div className="mt-1 text-[9px] text-slate-400 leading-none">{item.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Style Presets */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
            艺术风格
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {STYLE_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStyle(item.id)}
                disabled={isGenerating}
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border py-2.5 text-center transition hover:bg-slate-50 dark:hover:bg-white/5",
                  style === item.id
                    ? "border-brand-500 bg-brand-50/50 text-brand-700 dark:border-brand-400 dark:bg-brand-950/20 dark:text-brand-300"
                    : "border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400"
                )}
              >
                <span className={cn(
                  "mb-1.5",
                  style === item.id ? "text-brand-600 dark:text-brand-400" : "text-slate-400"
                )}>
                  {item.icon}
                </span>
                <span className="text-[10px] font-medium leading-none">{item.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* AI Prompt Optimizer Toggle */}
        <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/30 px-3 py-2 dark:border-white/5 dark:bg-slate-900/30">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">AI 提示词深度润色</span>
            <span className="text-[9px] text-slate-400">自动扩充优化为更精美的艺术提示词</span>
          </div>
          <button
            type="button"
            onClick={() => setOptimize(!optimize)}
            disabled={isGenerating}
            className={cn(
              "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
              optimize ? "bg-brand-600 dark:bg-brand-500" : "bg-slate-200 dark:bg-slate-800"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                optimize ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </div>

        {/* Advanced Accordion */}
        <div className="border-t border-slate-100 pt-2 dark:border-white/5">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <svg
              className={cn("h-3 w-3 transition-transform", showAdvanced && "rotate-90")}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            高级选项
          </button>

          {showAdvanced && (
            <div className="mt-2 space-y-2 animate-in fade-in duration-200">
              <div>
                <label className="mb-1 block text-[10px] text-slate-400">
                  随机种子 (Seed)
                </label>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="留空则使用随机数"
                  disabled={isGenerating}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-brand-300 focus:bg-white dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-100"
                />
              </div>
            </div>
          )}
        </div>

        {/* Generate / Stop Button */}
        <div className="pt-2">
          {isGenerating ? (
            <Button
              type="button"
              onClick={onStop}
              className="w-full bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                停止生成
              </span>
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!prompt.trim()}
              className="w-full bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 disabled:opacity-50"
            >
              <span className="flex items-center justify-center gap-1.5">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.656 48.656 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3M3 12a48.291 48.291 0 00.138 3.662 4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M3 12l-3 3m3-3l3 3" />
                </svg>
                开始渲染画面
              </span>
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
