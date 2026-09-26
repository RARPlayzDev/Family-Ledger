import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin text-content-muted', className)} aria-hidden="true" />;
}

/** Centered loading state for panels and routes. */
export function LoadingBlock({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex items-center justify-center gap-2 py-10 text-xs text-content-muted', className)}
    >
      <Spinner />
      {label}
    </div>
  );
}
