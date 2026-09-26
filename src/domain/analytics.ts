/**
 * Aggregation helpers.
 *
 * The monthly figures the app displays are produced in PostgreSQL (see
 * household_*_totals in the migrations) because RLS decides visibility there.
 * These functions handle the parts SQL should not do: filling empty days,
 * ranking, shares, comparisons and top-N selections - all pure and unit tested.
 */
import type { IsoDate, DateRange } from '@/domain/dates';
import { eachDayIso, formatDayShort } from '@/domain/dates';
import { percentChange, shareOfTotal, type PercentChange } from '@/domain/money';
import type {
  CategoryTotal,
  DailyTotal,
  ExpenseWithRelations,
  MemberTotal,
  PeriodTotals,
} from '@/types/domain';

export function buildDailySeries(range: DateRange, totals: readonly DailyTotal[]): DailyTotal[] {
  const byDay = new Map<IsoDate, DailyTotal>();
  for (const total of totals) {
    byDay.set(total.day, total);
  }
  return eachDayIso(range).map(
    (day) => byDay.get(day) ?? { day, total_paise: 0, expense_count: 0 },
  );
}

export type CumulativePoint = {
  day: IsoDate;
  label: string;
  total_paise: number;
  cumulative_paise: number;
  expense_count: number;
};

/** Running total per day; ideal for a month-progress line. */
export function buildCumulativeSeries(series: readonly DailyTotal[]): CumulativePoint[] {
  let running = 0;
  return series.map((point) => {
    running += point.total_paise;
    return {
      day: point.day,
      label: formatDayShort(point.day),
      total_paise: point.total_paise,
      cumulative_paise: running,
      expense_count: point.expense_count,
    };
  });
}

export function rankCategories(totals: readonly CategoryTotal[]): CategoryTotal[] {
  return [...totals].sort(
    (a, b) => b.total_paise - a.total_paise || a.category_name.localeCompare(b.category_name),
  );
}

export type CategoryTotalWithShare = CategoryTotal & { share_percent: number | null };

export function withCategoryShares(totals: readonly CategoryTotal[]): CategoryTotalWithShare[] {
  const ranked = rankCategories(totals);
  const total = ranked.reduce((sum, row) => sum + row.total_paise, 0);
  return ranked.map((row) => ({ ...row, share_percent: shareOfTotal(row.total_paise, total) }));
}

export type MemberTotalWithShare = MemberTotal & { share_percent: number | null };

export function withMemberShares(totals: readonly MemberTotal[]): MemberTotalWithShare[] {
  const total = totals.reduce((sum, row) => sum + row.total_paise, 0);
  return [...totals]
    .sort((a, b) => b.total_paise - a.total_paise)
    .map((row) => ({ ...row, share_percent: shareOfTotal(row.total_paise, total) }));
}

export function largestExpenses(
  expenses: readonly ExpenseWithRelations[],
  limit = 5,
): ExpenseWithRelations[] {
  return [...expenses]
    .sort((a, b) => b.amount_paise - a.amount_paise || a.expense_date.localeCompare(b.expense_date))
    .slice(0, Math.max(limit, 0));
}

export function latestExpenses(
  expenses: readonly ExpenseWithRelations[],
  limit = 8,
): ExpenseWithRelations[] {
  return [...expenses]
    .sort(
      (a, b) =>
        b.expense_date.localeCompare(a.expense_date) || b.created_at.localeCompare(a.created_at),
    )
    .slice(0, Math.max(limit, 0));
}

/** Average spend per elapsed day, in integer paise. */
export function averageDailySpend(totalPaise: number, daysCounted: number): number {
  if (daysCounted <= 0) return 0;
  return Math.round(totalPaise / daysCounted);
}

/** Quiet-month detection so we never divide by zero in the UI. */
export function hasAnySpending(totals: PeriodTotals | undefined | null): boolean {
  return (totals?.total_paise ?? 0) > 0;
}

export type PeriodComparison = {
  current: PeriodTotals;
  previous: PeriodTotals;
  delta_paise: number;
  change: PercentChange;
  hasPrevious: boolean;
};

export function comparePeriods(current: PeriodTotals, previous: PeriodTotals): PeriodComparison {
  return {
    current,
    previous,
    delta_paise: current.total_paise - previous.total_paise,
    change: percentChange(current.total_paise, previous.total_paise),
    hasPrevious: hasAnySpending(previous),
  };
}

export type CategoryMovement = CategoryTotal & {
  previous_paise: number;
  delta_paise: number;
  change: PercentChange;
};

/** Month-over-month movement per category (union of both months). */
export function compareCategoryTotals(
  current: readonly CategoryTotal[],
  previous: readonly CategoryTotal[],
): CategoryMovement[] {
  const previousByKey = new Map<string, number>();
  for (const row of previous) {
    previousByKey.set(row.category_id ?? 'uncategorised', row.total_paise);
  }

  const keys = new Set<string>();
  current.forEach((row) => keys.add(row.category_id ?? 'uncategorised'));
  previous.forEach((row) => keys.add(row.category_id ?? 'uncategorised'));

  const fallbackName = (key: string) => (key === 'uncategorised' ? 'Uncategorised' : 'Unknown');

  return [...keys]
    .map((key) => {
      const row = current.find((item) => (item.category_id ?? 'uncategorised') === key);
      const previousPaise = previousByKey.get(key) ?? 0;
      const totalPaise = row?.total_paise ?? 0;
      return {
        category_id: row?.category_id ?? (key === 'uncategorised' ? null : key),
        category_name: row?.category_name ?? fallbackName(key),
        category_icon: row?.category_icon ?? 'Tag',
        category_color: row?.category_color ?? '#6C737D',
        total_paise: totalPaise,
        expense_count: row?.expense_count ?? 0,
        previous_paise: previousPaise,
        delta_paise: totalPaise - previousPaise,
        change: percentChange(totalPaise, previousPaise),
      } satisfies CategoryMovement;
    })
    .sort((a, b) => Math.abs(b.delta_paise) - Math.abs(a.delta_paise));
}

/** Categories whose month-over-month spend increased the most. */
export function biggestIncreases(
  movements: readonly CategoryMovement[],
  limit = 3,
): CategoryMovement[] {
  return movements.filter((row) => row.delta_paise > 0).slice(0, Math.max(limit, 0));
}

/**
 * Category totals for an already-loaded expense list.
 *
 * Used by the member detail page, where the household-level SQL aggregates do not
 * apply (they are scoped to the whole ledger, not to one member).
 */
export function categoryTotalsFromExpenses(
  expenses: readonly ExpenseWithRelations[],
): CategoryTotal[] {
  const totals = new Map<string, CategoryTotal>();

  for (const expense of expenses) {
    const key = expense.category_id ?? 'uncategorised';
    const existing = totals.get(key);
    if (existing) {
      existing.total_paise += expense.amount_paise;
      existing.expense_count += 1;
      continue;
    }
    totals.set(key, {
      category_id: expense.category_id,
      category_name: expense.category?.name ?? 'Uncategorised',
      category_icon: expense.category?.icon ?? 'Tag',
      category_color: expense.category?.color ?? '#6C737D',
      total_paise: expense.amount_paise,
      expense_count: 1,
    });
  }

  return rankCategories([...totals.values()]);
}

/** Daily totals (zero-filled) for an already-loaded expense list. */
export function dailyTotalsFromExpenses(
  expenses: readonly ExpenseWithRelations[],
  range: DateRange,
): DailyTotal[] {
  const totals = new Map<IsoDate, DailyTotal>();
  for (const expense of expenses) {
    const existing = totals.get(expense.expense_date);
    if (existing) {
      existing.total_paise += expense.amount_paise;
      existing.expense_count += 1;
      continue;
    }
    totals.set(expense.expense_date, {
      day: expense.expense_date,
      total_paise: expense.amount_paise,
      expense_count: 1,
    });
  }
  return buildDailySeries(range, [...totals.values()]);
}

