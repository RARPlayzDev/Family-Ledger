import { cn } from '@/lib/utils';
import { formatINR, type INRDecimals } from '@/domain/money';

/**
 * Renders integer paise as an INR amount.
 *
 * Centralising this component is what keeps Indian digit grouping, the rupee
 * symbol and tabular alignment consistent on every screen (and prevents any
 * component from dividing by 100 on its own).
 */
export function Money({
  paise,
  decimals = 'auto',
  compact = false,
  showSign = false,
  className,
}: {
  paise: number;
  decimals?: INRDecimals;
  compact?: boolean;
  showSign?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('num', className)}>{formatINR(paise, { decimals, compact, showSign })}</span>
  );
}
