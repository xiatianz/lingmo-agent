"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface ImageHistoryItem {
  id: string;
  url: string;
  prompt: string;
  rawPrompt: string;
  aspectRatio: string;
  style: string;
  createdAt: string;
  width: number;
  height: number;
}

interface ImageHistoryProps {
  onLoadItem: (item: ImageHistoryItem) => void;
  currentItemId: string | null;
  newItem?: ImageHistoryItem | null;
}

const STORAGE_KEY = "lingmo.imageHistory.v1";

export function ImageHistory({ onLoadItem, currentItemId, newItem }: ImageHistoryProps) {
  const [items, setItems] = useState<ImageHistoryItem[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setItems(JSON.parse(raw));
      }
    } catch (e) {
      console.error("Failed to load image history:", e);
    }
  }, []);

  // Handle new item added
  useEffect(() => {
    if (newItem) {
      setItems((prev) => {
        // Prevent duplicate IDs
        const filtered = prev.filter((x) => x.id !== newItem.id);
        const next = [newItem, ...filtered].slice(0, 50); // Keep last 50 items
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
          console.error("Failed to save image history:", e);
        }
        return next;
      });
    }
  }, [newItem]);

  const handleDelete = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems((prev) => {
      const next = prev.filter((x) => x.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error("Failed to save image history:", e);
      }
      return next;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    if (window.confirm("确定要清空所有生图历史记录吗？")) {
      setItems([]);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }, []);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950">
        <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">生成历史</h3>
        <p className="py-6 text-center text-[10px] text-slate-400">暂无生图记录</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          生成历史
          <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-slate-100 px-1 text-[9px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {items.length}
          </span>
        </h3>
        <button
          onClick={handleClearAll}
          className="text-[10px] text-slate-400 hover:text-red-500 transition"
        >
          清空
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onLoadItem(item)}
            className={cn(
              "group relative aspect-square cursor-pointer overflow-hidden rounded-lg border bg-slate-50 transition hover:border-brand-400 dark:bg-slate-900",
              currentItemId === item.id
                ? "border-brand-500 ring-1 ring-brand-500/20 dark:border-brand-400"
                : "border-slate-200 dark:border-white/5"
            )}
            title={item.rawPrompt}
          >
            <img
              src={item.url}
              alt=""
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
            {/* Aspect Ratio Badge */}
            <span className="absolute left-1 top-1 rounded bg-black/50 px-1 text-[8px] text-white backdrop-blur-[2px] leading-none py-0.5">
              {item.aspectRatio}
            </span>
            {/* Delete button */}
            <button
              onClick={(e) => handleDelete(item.id, e)}
              className="absolute right-1 top-1 hidden h-4 w-4 items-center justify-center rounded bg-black/60 text-white backdrop-blur-[2px] transition hover:bg-red-600 group-hover:flex"
              title="删除此记录"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
