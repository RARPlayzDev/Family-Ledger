import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useToast, type Toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const TONE_STYLES: Record<NonNullable<Toast['tone']>, string> = {
  default: 'border-line bg-surface text-content',
  success: 'border-accent/30 bg-surface text-content',
  error: 'border-danger/40 bg-surface text-content',
};

function ToastIcon({ tone }: { tone: NonNullable<Toast['tone']> }) {
  if (tone === 'success') return <CheckCircle2 className="size-4 text-accent" />;
  if (tone === 'error') return <AlertTriangle className="size-4 text-danger" />;
  return <Info className="size-4 text-content-muted" />;
}

/**
 * Toast host.
 * On phones it sits above the bottom navigation and above the safe area so it is
 * never hidden behind the Android gesture bar.
 */
export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className={cn(
        'pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4',
        'bottom-[calc(5.5rem+env(safe-area-inset-bottom))]',
        'lg:inset-x-auto lg:bottom-6 lg:right-6 lg:items-end lg:px-0',
      )}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-3 shadow-pop animate-toast-in',
            TONE_STYLES[toast.tone ?? 'default'],
          )}
        >
          <span className="mt-0.5">
            <ToastIcon tone={toast.tone ?? 'default'} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug">{toast.title}</p>
            {toast.description ? (
              <p className="mt-0.5 text-xs leading-relaxed text-content-muted">{toast.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
            className="rounded-sm p-1 text-content-subtle transition-colors hover:bg-surface-raised hover:text-content"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
