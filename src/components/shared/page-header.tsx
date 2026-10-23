import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Consistent page heading with an optional action slot.
 *
 * Phones stack the heading above its actions; from `sm` it sits on one row.
 * Minimal, quiet heading that lets the content take the stage.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-tight text-content sm:text-xl">
          {title}
        </h1>
        {subtitle ? (
          <div className="mt-0.5 text-xs text-content-muted">{subtitle}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
