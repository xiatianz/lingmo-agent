import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-offset-slate-950',
        {
          'bg-gradient-to-r from-brand-900 via-brand-700 to-brand-500 text-white shadow-[0_10px_24px_rgba(71,48,155,0.28)] hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(71,48,155,0.34)]': variant === 'primary',
          'border border-white/70 bg-white/75 text-slate-800 shadow-sm hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20': variant === 'secondary',
          'text-slate-600 hover:bg-white/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white': variant === 'ghost',
          'border border-slate-200/80 bg-white/70 text-slate-700 shadow-sm hover:border-brand-200 hover:bg-brand-50/70 hover:text-brand-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-brand-700 dark:hover:bg-brand-900/20 dark:hover:text-brand-200': variant === 'outline',
        },
        {
          'h-8 px-3 text-sm': size === 'sm',
          'h-10 px-4 text-sm': size === 'md',
          'h-12 px-6 text-base': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
