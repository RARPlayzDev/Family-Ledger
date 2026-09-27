import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Consistent page heading with an optional action slot.
 *
 * Phones stack the heading above its actions: the title, the month stepper and the
 * buttons each get a full row, instead of fighting over one and truncating the
 * household name. From `sm` upwards it goes back to a single right-aligned row.
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
        'flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between',
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
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end sm:gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
