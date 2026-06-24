'use client';

import { useI18n } from '@/lib/i18n';

export function LanguageToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <button
      onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
      aria-label="Toggle language"
      className="inline-flex h-9 items-center rounded-lg border border-white/70 bg-white/70 px-3 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
    >
      {locale === 'zh' ? 'EN' : '中文'}
    </button>
  );
}
