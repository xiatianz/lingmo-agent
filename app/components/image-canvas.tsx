"use client";

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ImageCanvasProps {
  url: string | null;
  prompt: string | null;
  rawPrompt: string | null;
  aspectRatio: string;
  isGenerating: boolean;
  error: string | null;
}

export function ImageCanvas({
  url,
  prompt,
  rawPrompt,
  aspectRatio,
  isGenerating,
  error,
}: ImageCanvasProps) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [copyUrlStatus, setCopyUrlStatus] = useState<"idle" | "copied">("idle");
  const [generationTime, setGenerationTime] = useState(0);

  // Simple loading timer to keep the user engaged
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isGenerating) {
      setGenerationTime(0);
      timer = setInterval(() => {
        setGenerationTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isGenerating]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    });
  }, []);

  const copyUrlToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyUrlStatus("copied");
      setTimeout(() => setCopyUrlStatus("idle"), 2000);
    });
  }, []);

  const downloadImage = useCallback(() => {
    if (!url) return;
    const downloadUrl = `/api/download-image?url=${encodeURIComponent(url)}`;
    window.location.href = downloadUrl;
  }, [url]);

  // Determine aspect ratio class
  const getRatioClass = () => {
    switch (aspectRatio) {
      case "16:9":
        return "aspect-video";
      case "9:16":
        return "aspect-[9/16]";
      case "4:3":
        return "aspect-[4/3]";
      case "1:1":
      default:
        return "aspect-square";
    }
  };

  return (
    <div className="flex flex-1 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950 lg:h-full lg:overflow-hidden">
      {/* Top action bar */}
      <div className="mb-3 flex flex-col gap-2 pb-3 border-b border-slate-100 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          创意画布
        </h2>
        {url && !isGenerating && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => copyToClipboard(prompt || "")}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/5"
              title="复制AI润色后的英文提示词"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              {copyStatus === "copied" ? "已复制" : "复制提示词"}
            </button>
            <button
              onClick={() => copyUrlToClipboard(url)}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/5"
              title="复制图片临时链接（24小时内有效）"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {copyUrlStatus === "copied" ? "已复制 (24h有效)" : "复制链接"}
            </button>
            <button
              onClick={downloadImage}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-medium text-white shadow-sm transition hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              下载大图
            </button>
          </div>
        )}
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex items-center justify-center min-h-[300px] lg:min-h-0 lg:overflow-hidden relative">
        {/* Case 1: Generating Loading State */}
        {isGenerating && (
          <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center p-6 animate-pulse">
            <div className={cn(
              "w-full bg-slate-100 dark:bg-slate-900 rounded-lg flex flex-col items-center justify-center border border-slate-200 dark:border-white/5 relative overflow-hidden",
              getRatioClass()
            )}>
              {/* Shimmer Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer" />
              <div className="flex flex-col items-center gap-3 z-10">
                <svg className="h-8 w-8 animate-spin text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <div className="text-center">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">正在生成艺术画作...</p>
                  <p className="mt-1 text-[10px] text-slate-400">已用时 {generationTime} 秒</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Case 2: Error State */}
        {!isGenerating && error && (
          <div className="text-center p-6 max-w-sm mx-auto">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/20 text-red-500 mb-3">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">渲染失败</h3>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{error}</p>
          </div>
        )}

        {/* Case 3: Image Render State */}
        {!isGenerating && !error && url && (
          <div className="w-full h-full flex flex-col items-center justify-center lg:overflow-hidden py-2">
            <div className="max-w-full max-h-full flex items-center justify-center relative group">
              <img
                src={url}
                alt={prompt || "AI Art"}
                className={cn(
                  "rounded-lg border border-slate-200 dark:border-white/10 shadow-md object-contain max-h-[45vh] lg:max-h-[58vh] cursor-zoom-in hover:brightness-95 transition duration-200",
                  getRatioClass()
                )}
                onClick={() => setZoomOpen(true)}
              />
              <button
                onClick={() => setZoomOpen(true)}
                className="absolute right-3 bottom-3 hidden group-hover:flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80"
                title="全屏预览"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
              </button>
            </div>
            <div className="mt-4 w-full max-w-lg text-center">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 px-4" title={rawPrompt || ""}>
                <span className="font-semibold text-slate-700 dark:text-slate-300">原意图: </span>
                {rawPrompt}
              </p>
            </div>
          </div>
        )}

        {/* Case 4: Initial Empty State */}
        {!isGenerating && !error && !url && (
          <div className="text-center p-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 mb-3 text-slate-400">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">创意画布空置中</h3>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 max-w-[240px] mx-auto">
              在左侧面板描述你的创意，点击开始渲染即可在这里呈现精美的 AI 艺术画作。
            </p>
          </div>
        )}
      </div>

      {/* Lightbox / Zoom Modal */}
      {zoomOpen && url && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 transition-all duration-300">
          <button
            onClick={() => setZoomOpen(false)}
            className="absolute right-4 top-4 z-[210] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
            aria-label="关闭预览"
          >
            &times;
          </button>
          <div className="max-h-full max-w-full flex flex-col items-center justify-center gap-4">
            <img
              src={url}
              alt={prompt || "AI Art Fullscreen"}
              className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
            />
            {prompt && (
              <p className="max-w-2xl text-center text-xs text-white/80 bg-black/60 px-4 py-2 rounded-lg backdrop-blur-sm line-clamp-2">
                {prompt}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
