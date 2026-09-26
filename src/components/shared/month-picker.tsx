import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { currentMonthKey, formatMonthLabel, shiftMonthKey, type MonthKey } from '@/domain/dates';
import { cn } from '@/lib/utils';

/**
 * Month stepper.
 * Months are the primary period in the app (budgets, analytics, dashboard) and
 * the selected month is always explicit, never implied by "today".
 */
export function MonthPicker({
  value,
  onChange,
  className,
}: {
  value: MonthKey;
  onChange: (next: MonthKey) => void;
  className?: string;
}) {
  const isCurrentMonth = value === currentMonthKey();

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-md border border-line bg-surface-raised p-0.5',
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Previous month"
        onClick={() => onChange(shiftMonthKey(value, -1))}
      >
        <ChevronLeft />
      </Button>
      <span className="num min-w-[7.5rem] text-center text-xs font-medium text-content sm:text-sm">
        {formatMonthLabel(value)}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Next month"
        disabled={isCurrentMonth}
        onClick={() => onChange(shiftMonthKey(value, 1))}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
