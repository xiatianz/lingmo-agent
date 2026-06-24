import React, { useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Ghost text shown when input is empty (AI suggestion) */
  suggestion?: string;
  /** Hint text next to the Tab badge */
  suggestionHint?: string;
  /** Called when user presses Tab to accept suggestion */
  onAcceptSuggestion?: () => void;
}

export function Input({ className, label, id, suggestion, suggestionHint, onAcceptSuggestion, onKeyDown, onFocus, ...props }: InputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && suggestion && onAcceptSuggestion && !props.value) {
      e.preventDefault();
      onAcceptSuggestion();
    }
    onKeyDown?.(e);
  }, [suggestion, onAcceptSuggestion, onKeyDown, props.value]);

  const showSuggestion = suggestion && !props.value;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          className={cn(
            'flex h-10 w-full rounded-lg border border-white/80 bg-white/70 px-3 py-2 text-sm text-slate-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] placeholder:text-slate-400 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-brand-700 dark:focus:bg-slate-950/60',
            className
          )}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          {...props}
          placeholder={showSuggestion ? '' : props.placeholder}
        />
        {showSuggestion && (
          <>
            <div className="pointer-events-none absolute inset-0 flex items-center px-3">
              <span className="truncate text-sm text-slate-300 dark:text-slate-600">
                {suggestion}
              </span>
            </div>
            {suggestionHint && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <span className="inline-flex items-center gap-1 rounded border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-400">
                  <kbd className="font-mono text-[9px] bg-white dark:bg-gray-800 rounded px-0.5 border border-gray-200 dark:border-gray-700">Tab</kbd>
                  {suggestionHint}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
