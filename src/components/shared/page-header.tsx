import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Consistent page heading with an optional action slot. */
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
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-tight text-content sm:text-xl">
          {title}
        </h1>
        {subtitle ? (
          <div className="mt-0.5 text-xs text-content-muted">{subtitle}</div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
