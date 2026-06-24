"use client";

import { useState, useCallback, useRef, useEffect, MutableRefObject } from "react";
import ReactMarkdown from "react-markdown";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/ui/brand-mark";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

interface ArticleVersion {
  content: string;
  createdAt: string;
  wordCount: number;
}

interface ArticleEditorProps {
  content: string;
  isGenerating: boolean;
  isGeneratingOutline?: boolean;
  isRefining?: boolean;
  isLoadingArticle?: boolean;
  hasOutline?: boolean;
  versions?: ArticleVersion[];
  currentVersionIndex?: number;
  onVersionSwitch?: (index: number) => void;
  refinedSectionIndex?: number | null;
  scrollRef?: MutableRefObject<{ scrollToTop: () => void; scrollToSection: (index: number) => void } | null>;
}

export function ArticleEditor({
  content,
  isGenerating,
  isGeneratingOutline = false,
  isRefining = false,
  isLoadingArticle = false,
  hasOutline = false,
  versions = [],
  currentVersionIndex = 0,
  onVersionSwitch,
  refinedSectionIndex,
  scrollRef,
}: ArticleEditorProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Expose scroll methods via ref
  useEffect(() => {
    if (scrollRef) {
      scrollRef.current = {
        scrollToTop: () => {
          contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        },
        scrollToSection: (index: number) => {
          const headings = contentRef.current?.querySelectorAll('h2');
          if (headings && headings[index]) {
            headings[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        },
      };
    }
  }, [scrollRef]);

  // ESC to exit focus mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocused) setIsFocused(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFocused]);

  // Fade-in effect when loading article
  useEffect(() => {
    if (isLoadingArticle) {
      setFadeIn(false);
    } else {
      // Trigger fade-in after loading completes
      const timer = setTimeout(() => setFadeIn(true), 50);
      return () => clearTimeout(timer);
    }
  }, [isLoadingArticle]);

  // Auto-scroll to bottom while generating
  useEffect(() => {
    if (isGenerating && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isGenerating]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content]);

  if (!content && !isGenerating && !isGeneratingOutline) {
    if (hasOutline) return null;
    return (
      <Card className="flex min-h-[360px] items-center justify-center bg-white/75 lg:min-h-0 lg:flex-1 dark:bg-slate-900/70">
        <div className="text-center px-8">
          <BrandMark className="mx-auto mb-4 h-16 w-16 rounded-lg" />
          <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t.readyToCreate}
          </h3>
          <p className="max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
            {t.readyToCreateDesc}
          </p>
        </div>
      </Card>
    );
  }

  if (!content && isGeneratingOutline) {
    return (
      <Card className="relative flex min-h-[360px] items-center justify-center overflow-hidden bg-white/75 lg:min-h-0 lg:flex-1 dark:bg-slate-900/70">
        <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-brand-100 dark:bg-brand-950">
          <div className="h-full w-1/2 animate-shimmer rounded-full bg-gradient-to-r from-brand-900 via-brand-600 to-brand-400" />
        </div>
        <div className="mx-auto max-w-md px-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 shadow-[0_18px_45px_rgba(72,56,160,0.28)]">
            <BrandMark className="h-10 w-10" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-slate-950 dark:text-slate-50">
            {(t as any).generatingOutlineTitle}
          </h3>
          <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
            {(t as any).generatingOutlineDesc}
          </p>
          <div className="mt-6 grid gap-2 text-left">
            {[
              t.research,
              t.outline,
              t.seo,
            ].map((label, index) => (
              <div key={label} className="flex items-center gap-2 rounded-lg border border-white/70 bg-white/55 px-3 py-2 text-xs text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                  {index + 1}
                </span>
                <span>{label}</span>
                <span className="ml-auto flex gap-0.5">
                  <span className="h-1 w-1 animate-bounce rounded-full bg-brand-400 [animation-delay:0ms]" />
                  <span className="h-1 w-1 animate-bounce rounded-full bg-brand-400 [animation-delay:150ms]" />
                  <span className="h-1 w-1 animate-bounce rounded-full bg-brand-400 [animation-delay:300ms]" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  const versionLabel = versions.length > 0
    ? `v${currentVersionIndex + 1} · ${new Date(versions[currentVersionIndex]?.createdAt || '').toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : null;

  return (
    <>
    <Card className="relative flex min-h-[300px] flex-col overflow-hidden lg:min-h-0 lg:flex-1">
      {/* Loading overlay for article loading */}
      {isLoadingArticle && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/60 backdrop-blur-sm dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {t.loadArticle}...
          </div>
        </div>
      )}

      {/* Refining overlay */}
      {isRefining && (
        <div className="absolute inset-0 z-10 pointer-events-none rounded-xl overflow-hidden">
          <div className="absolute inset-0 bg-brand-50/30 dark:bg-brand-900/10 animate-pulse" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-200/70 bg-white/40 px-5 py-3 backdrop-blur dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center gap-3">
          {isGenerating && (
            <span className="flex items-center gap-2 text-sm text-brand-600">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-500" />
              {(t as any).writingStatus}
            </span>
          )}
          {isRefining && (
            <span className="flex items-center gap-2 text-sm text-orange-600">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-orange-500" />
              {t.modifying}
            </span>
          )}
          {!isGenerating && !isRefining && content && (
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {(() => {
                const chinese = (content.match(/[\u4e00-\u9fff]/g) || []).length;
                const english = content.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(Boolean).length;
                return chinese + english;
              })()} {t.wordCount}
            </span>
          )}

          {/* Version indicator */}
          {versionLabel && versions.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 dark:text-brand-400 dark:bg-brand-900/30 dark:hover:bg-brand-900/50 transition-colors"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {versionLabel} · {versions.length} {t.versions}
                <svg className={cn("h-3 w-3 transition-transform", showVersionDropdown && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Version dropdown */}
              {showVersionDropdown && (
                <div className="absolute top-full left-0 mt-1 z-20 w-56 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{t.versionHistory}</span>
                  </div>
                  <ul className="max-h-48 overflow-y-auto py-1">
                    {versions.map((v, i) => (
                      <li key={i}>
                        <button
                          onClick={() => {
                            onVersionSwitch?.(i);
                            setShowVersionDropdown(false);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors",
                            i === currentVersionIndex && "bg-brand-50 dark:bg-brand-900/20"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span className={cn(
                              "font-medium",
                              i === currentVersionIndex ? "text-brand-700 dark:text-brand-400" : "text-gray-700 dark:text-gray-300"
                            )}>
                              v{i + 1}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              {new Date(v.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </span>
                          <span className="text-gray-400">{v.wordCount} {t.characters}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right side: copy + expand */}
        <div className="flex items-center gap-2">
          {content && !isGenerating && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/50 transition-colors"
              title={copied ? t.copied : t.copy}
            >
              {copied ? (
                <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
              {copied ? t.copied : t.copy}
            </button>
          )}
          {content && (
            <button
              onClick={() => setIsFocused(true)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/50 transition-colors"
              title={t.focusMode}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              {t.focusMode}
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div
        ref={contentRef}
        data-article-content
        className="min-h-0 flex-1 overflow-y-auto bg-white/40 px-8 py-6 dark:bg-slate-950/20"
      >
        <div className={cn(
          "prose-editor transition-opacity duration-300",
          isLoadingArticle ? "opacity-0" : fadeIn ? "opacity-100" : "opacity-100"
        )}>
          {content ? (
            <ReactMarkdown>{content}</ReactMarkdown>
          ) : isGenerating ? (
            <div className="flex min-h-[260px] items-center justify-center text-center">
              <div className="max-w-sm">
                <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-lg bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500" />
                <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                  {(t as any).writingStatus}
                </h3>
                <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {(t as any).writingStatusDesc}
                </p>
              </div>
            </div>
          ) : null}
        </div>
        {isGenerating && (
          <div className="mt-4 animate-shimmer h-4 rounded" />
        )}
      </div>
    </Card>

    {/* Focus mode overlay (portal) */}
    {isFocused && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-950 animate-in fade-in duration-200">
        {/* Focus mode toolbar */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            {isGenerating && (
              <span className="flex items-center gap-2 text-sm text-brand-600">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-500" />
                {(t as any).writingStatus}
              </span>
            )}
            {isRefining && (
              <span className="flex items-center gap-2 text-sm text-orange-600">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-orange-500" />
                {t.modifying}
              </span>
            )}
            {!isGenerating && !isRefining && content && (
              <span className="text-sm text-gray-400">
                {(() => {
                  const chinese = (content.match(/[\u4e00-\u9fff]/g) || []).length;
                  const english = content.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(Boolean).length;
                  return chinese + english;
                })()} {t.wordCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {content && !isGenerating && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/50 transition-colors"
              >
                {copied ? (
                  <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
                {copied ? t.copied : t.copy}
              </button>
            )}
            <button
              onClick={() => setIsFocused(false)}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
              {t.exitFocusMode}
              <kbd className="ml-1 text-[10px] text-gray-400 dark:text-gray-500">Esc</kbd>
            </button>
          </div>
        </div>

        {/* Focus mode content */}
        <div
          data-article-content
          className="flex-1 overflow-y-auto w-full"
        >
          <div className="max-w-4xl mx-auto px-8 py-8">
            <div className="prose-editor">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
            {isGenerating && (
              <div className="mt-4 animate-shimmer h-4 rounded" />
            )}
          </div>
        </div>
      </div>,
      document.body
    )}
  </>
  );
}
