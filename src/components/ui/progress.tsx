import { cn } from '@/lib/utils';

/**
 * Thin progress bar used for budget utilisation.
 * Implemented as plain divs on purpose: Radix's progress primitive adds no value
 * here and the animation must stay cheap on low-end Android devices.
 */
export function Progress({
  value,
  tone = 'accent',
  className,
}: {
  /** 0..100 (values above 100 are clamped for the bar, not for the label). */
  value: number;
  tone?: 'accent' | 'warn' | 'danger' | 'neutral';
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(value, 100));
  const toneClass = {
    accent: 'bg-accent',
    warn: 'bg-warn',
    danger: 'bg-danger',
    neutral: 'bg-content-subtle',
  }[tone];

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', toneClass)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
