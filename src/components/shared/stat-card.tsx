import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Money } from '@/components/shared/money';
import { cn } from '@/lib/utils';
import { formatPercent, type PercentChange } from '@/domain/money';

export type StatTone = 'neutral' | 'positive' | 'warn' | 'danger';

const TONE_TEXT: Record<StatTone, string> = {
  neutral: 'text-content',
  positive: 'text-accent',
  warn: 'text-warn',
  danger: 'text-danger',
};

/**
 * KPI tile.
 * `delta` uses the PercentChange domain type so an undefined comparison (no spend
 * last month) is rendered as wording rather than a fake 0% or a crash.
 */
export function StatCard({
  label,
  paise,
  hint,
  tone = 'neutral',
  delta,
  icon,
  className,
}: {
  label: string;
  paise: number;
  hint?: string;
  tone?: StatTone;
  delta?: { change: PercentChange; goodDirection?: 'up' | 'down' };
  icon?: ReactNode;
  className?: string;
}) {
  const change = delta?.change;
  const goodDirection = delta?.goodDirection ?? 'down';

  let deltaTone: StatTone = 'neutral';
  let DeltaIcon = Minus;
  if (change?.defined && change.direction !== 'flat') {
    DeltaIcon = change.direction === 'up' ? ArrowUpRight : ArrowDownRight;
    const isGood = change.direction === goodDirection;
    deltaTone = isGood ? 'positive' : 'warn';
  }

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="label-caps">{label}</p>
        {icon ? <span className="text-content-subtle [&_svg]:size-4">{icon}</span> : null}
      </div>
      <p className={cn('mt-2 text-xl font-semibold tracking-tight sm:text-2xl', TONE_TEXT[tone])}>
        <Money paise={paise} />
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {change ? (
          <span className={cn('inline-flex items-center gap-1', TONE_TEXT[deltaTone])}>
            <DeltaIcon className="size-3.5" />
            {change.defined ? formatPercent(Math.abs(change.percent ?? 0)) : 'new'}
          </span>
        ) : null}
        {hint ? <span className="text-content-muted">{hint}</span> : null}
      </div>
    </Card>
  );
}
