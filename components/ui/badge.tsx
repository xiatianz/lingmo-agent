import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'info' | 'warning' | 'error' | 'success';
}

export function Badge({ className, variant = 'info', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium shadow-sm',
        {
          'border-blue-200 bg-blue-50/80 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300': variant === 'info',
          'border-amber-200 bg-amber-50/80 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300': variant === 'warning',
          'border-red-200 bg-red-50/80 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300': variant === 'error',
          'border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300': variant === 'success',
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
