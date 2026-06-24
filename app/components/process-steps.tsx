"use client";

import { cn } from "@/lib/utils";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import type { Step, StepStatus } from "../page";

interface ProcessStepsProps {
  steps: Record<Step, StepStatus>;
  stepTokens?: Record<string, number>;
}

const STEP_ICONS: Record<Step, string> = {
  research: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  outline: "M4 6h16M4 10h16M4 14h16M4 18h16",
  writing: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  review: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  refine: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
};

// Each step maps to its own token key
const STEP_TOKEN_KEY: Record<Step, string | null> = {
  research: null,       // research is part of outline call
  outline: 'outline',
  writing: 'writing',
  review: null,
  refine: 'refine',
};

function formatTokens(n: number): string {
  if (n === 0) return '';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k tokens`;
  return `${n} tokens`;
}

export function ProcessSteps({ steps, stepTokens = {} }: ProcessStepsProps) {
  const { t } = useI18n();

  const stepLabels: Record<Step, string> = {
    research: t.research,
    outline: t.outline,
    writing: t.writing,
    review: t.review,
    refine: t.refine,
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <svg className="h-4 w-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          {t.workflow}
        </h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {(Object.keys(STEP_ICONS) as Step[]).map((key, index) => {
            const status = steps[key];
            const tokenKey = STEP_TOKEN_KEY[key];
            const tokens = tokenKey ? stepTokens[tokenKey] : undefined;

            return (
              <div key={key} className="flex items-center gap-2 rounded-lg px-1 py-0.5">
                <div
                  className={cn(
                    "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border transition-all duration-300",
                    {
                      "border-slate-200 bg-white/70 dark:border-white/10 dark:bg-white/5": status === "pending",
                      "border-brand-400 bg-brand-50 text-brand-600 shadow-sm dark:border-brand-700 dark:bg-brand-900/30": status === "active",
                      "border-emerald-400 bg-emerald-50 text-emerald-600 shadow-sm dark:border-emerald-700 dark:bg-emerald-900/30": status === "done",
                    }
                  )}
                >
                  {status === "done" ? (
                    <svg className="h-3 w-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : status === "active" ? (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
                  ) : (
                    <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={STEP_ICONS[key]} />
                    </svg>
                  )}
                </div>

                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span
                    className={cn("text-sm transition-colors duration-300", {
                      "text-slate-400 dark:text-slate-500": status === "pending",
                      "text-brand-600 dark:text-brand-400 font-medium": status === "active",
                      "text-slate-700 dark:text-slate-300": status === "done",
                    })}
                  >
                    {stepLabels[key]}
                  </span>
                  {status === "done" && tokens && tokens > 0 && (
                    <span className="inline-flex items-center rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm dark:bg-white/10 dark:text-slate-400">
                      {formatTokens(tokens)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
