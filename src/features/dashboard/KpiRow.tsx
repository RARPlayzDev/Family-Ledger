import { BarChart3, CalendarClock, PiggyBank, TrendingUp } from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { averageDailySpend, comparePeriods } from '@/domain/analytics';
import { daysElapsedInMonth, daysInMonth } from '@/domain/dates';
import { formatINR } from '@/domain/money';
import type { PeriodTotals } from '@/types/domain';


/** Four headline numbers for the selected month. */
export function KpiRow({
  totals,
  previousTotals,
  monthKey,
  today,
}: {
  totals: PeriodTotals;
  previousTotals: PeriodTotals;
  monthKey: string;
  today: string;
}) {
  const comparison = comparePeriods(totals, previousTotals);
  const elapsed = daysElapsedInMonth(monthKey, today);
  const totalDays = daysInMonth(monthKey);
  const perDay = averageDailySpend(totals.total_paise, elapsed);

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard
        label="Household spend"
        paise={totals.total_paise}
        delta={{ change: comparison.change, goodDirection: 'down' }}
        hint="vs last month"
        icon={<TrendingUp />}
      />
      <StatCard
        label="Average per day"
        paise={perDay}
        hint={`over ${elapsed} of ${totalDays} days`}
        icon={<CalendarClock />}
      />
      <StatCard
        label="Largest expense"
        paise={totals.largest_expense_paise}
        hint={
          totals.expense_count > 0
            ? `of ${totals.expense_count} expenses`
            : 'nothing recorded yet'
        }
        icon={<BarChart3 />}
      />
      <StatCard
        label="Average expense"
        paise={totals.average_expense_paise}
        hint={
          comparison.hasPrevious
            ? `Last month ${formatINR(previousTotals.total_paise, { decimals: 0 })}`
            : 'No spending last month'
        }
        icon={<PiggyBank />}
      />
    </div>
  );
}
