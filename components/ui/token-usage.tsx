'use client';

export function TokenUsage({ inputTokens, outputTokens }: { inputTokens: number; outputTokens: number }) {
  const total = inputTokens + outputTokens;
  if (total === 0) return null;
  return (
    <div className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-200/70 bg-brand-50/75 px-3 text-xs font-medium text-brand-700 shadow-sm backdrop-blur dark:border-brand-700/40 dark:bg-brand-900/30 dark:text-brand-200">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      Tokens: {total.toLocaleString()} (in: {inputTokens.toLocaleString()}, out: {outputTokens.toLocaleString()})
    </div>
  );
}
