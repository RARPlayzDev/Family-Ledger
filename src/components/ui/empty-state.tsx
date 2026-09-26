import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Empty / error / no-results state.
 * One component keeps the "something is missing here" moments visually identical
 * and gives every screen an actionable next step.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line px-5 py-10 text-center',
        className,
      )}
    >
      {icon ? (
        <span className="flex size-10 items-center justify-center rounded-full bg-surface-raised text-content-subtle [&_svg]:size-5">
          {icon}
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-medium text-content">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-xs leading-relaxed text-content-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
