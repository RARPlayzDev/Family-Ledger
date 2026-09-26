import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarClock, Minus, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { MonthPicker } from '@/components/shared/month-picker';
import { Money } from '@/components/shared/money';
import { CategoryIcon } from '@/components/shared/category-icon';
import { CategoryDonutChart } from '@/components/charts/CategoryDonutChart';
import { CategoryLegend } from '@/components/charts/CategoryBarChart';
import { MemberBarChart } from '@/components/charts/MemberBarChart';
import { DailySpendChart } from '@/components/charts/DailySpendChart';
import { useCategoryTotals, useMonthlyInsights } from '@/hooks/use-analytics';
import { useHousehold } from '@/hooks/use-household';
import {
  averageDailySpend,
  biggestIncreases,
  buildCumulativeSeries,
  compareCategoryTotals,
  comparePeriods,
  withCategoryShares,
} from '@/domain/analytics';
import { projectMonthEndSpend } from '@/domain/budgets';
import {
  currentMonthKey,
  daysElapsedInMonth,
  daysInMonth,
  formatMonthLabel,
  monthRange,
  previousMonthKey,
  todayIsoInTimeZone,
} from '@/domain/dates';
import { formatINR, formatPercent } from '@/domain/money';
import { errorMessage } from '@/lib/errors';

/**
 * Analytics.
 *
 * Answers the questions a family actually asks: how much did we spend, where did it
 * go, who spent it, and what changed versus last month. Month-over-month movement
 * comes from two scoped aggregate calls, never from re-adding partial pages in the
 * browser.
 */
export function AnalyticsPage() {
  const { householdId, timezone } = useHousehold();
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const today = todayIsoInTimeZone(timezone);

  const insights = useMonthlyInsights(householdId, monthKey);
  const data = insights.data;

  const previousRange = useMemo(() => monthRange(previousMonthKey(monthKey)), [monthKey]);
  const previousCategories = useCategoryTotals({
    householdId,
    from: previousRange.from,
    to: previousRange.to,
  });

  const categoryShares = useMemo(
    () => withCategoryShares(data?.categoryTotals ?? []),
    [data?.categoryTotals],
  );

  const movements = useMemo(
    () => compareCategoryTotals(data?.categoryTotals ?? [], previousCategories.data ?? []),
    [data?.categoryTotals, previousCategories.data],
  );

  const comparison = data ? comparePeriods(data.totals, data.previousTotals) : null;
  const elapsed = daysElapsedInMonth(monthKey, today);
  const totalDays = daysInMonth(monthKey);
  const projected = data ? projectMonthEndSpend(data.totals.total_paise, elapsed, totalDays) : 0;
  const perDay = data ? averageDailySpend(data.totals.total_paise, elapsed) : 0;
  const increases = biggestIncreases(movements, 3);
  const cumulative = useMemo(
    () => buildCumulativeSeries(data?.dailyTotals ?? []),
    [data?.dailyTotals],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics"
        subtitle={`Understanding ${formatMonthLabel(monthKey)} across the shared household ledger`}
        actions={<MonthPicker value={monthKey} onChange={setMonthKey} />}
      />

      {insights.isError ? (
        <Card className="border-danger/30 p-4 text-xs text-content-muted">
          {errorMessage(insights.error)}
          <Button
            variant="secondary"
            size="sm"
            className="ml-3"
            onClick={() => void insights.refetch()}
          >
            Retry
          </Button>
        </Card>
      ) : null}

      {insights.isLoading || !data || !comparison ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-64 w-full" />
          ))}
        </div>
      ) : (
        <>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="p-4">
              <p className="label-caps">Spent in {formatMonthLabel(monthKey, 'MMM')}</p>
              <p className="mt-2 text-2xl font-semibold">
                <Money paise={data.totals.total_paise} />
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs">
                {comparison.change.defined ? (
                  <>
                    {comparison.change.direction === 'up' ? (
                      <ArrowUpRight className="size-3.5 text-warn" />
                    ) : comparison.change.direction === 'down' ? (
                      <ArrowDownRight className="size-3.5 text-accent" />
                    ) : (
                      <Minus className="size-3.5 text-content-subtle" />
                    )}
                    <span
                      className={
                        comparison.change.direction === 'up' ? 'text-warn' : 'text-content-muted'
                      }
                    >
                      {formatPercent(Math.abs(comparison.change.percent ?? 0))} vs{' '}
                      {formatINR(data.previousTotals.total_paise, { decimals: 0 })}
                    </span>
                  </>
                ) : (
                  <span className="text-content-muted">
                    No spending last month, so there is no baseline
                  </span>
                )}
              </p>
            </Card>

            <Card className="p-4">
              <p className="label-caps">Average per day</p>
              <p className="mt-2 text-2xl font-semibold">
                <Money paise={perDay} />
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-content-muted">
                <CalendarClock className="size-3.5" />
                across {elapsed} of {totalDays} days
              </p>
            </Card>

            <Card className="p-4">
              <p className="label-caps">Projected month end</p>
              <p className="mt-2 text-2xl font-semibold">
                <Money paise={projected} />
              </p>
              <p className="mt-1 text-xs text-content-muted">
                Straight-line projection from the {elapsed} days recorded so far
              </p>
            </Card>

            <Card className="p-4">
              <p className="label-caps">Largest increase</p>
              <p className="mt-2 truncate text-base font-semibold">
                {increases[0]?.category_name ?? 'Nothing increased'}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-content-muted">
                <TrendingDown className="size-3.5" />
                {increases[0]
                  ? `+${formatINR(increases[0].delta_paise, { decimals: 0 })} vs last month`
                  : 'Category spending is flat or lower'}
              </p>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="p-4">
              <p className="text-sm font-semibold text-content">Category split</p>
              <p className="text-xs text-content-muted">
                Share of {formatMonthLabel(monthKey, 'MMMM')} spending
              </p>
              <div className="mt-2">
                <CategoryDonutChart categories={categoryShares} />
              </div>
              <CategoryLegend categories={categoryShares} limit={6} />
            </Card>

            <Card className="p-4">
              <p className="text-sm font-semibold text-content">Who spent what</p>
              <p className="text-xs text-content-muted">
                Members are compared on the same shared ledger
              </p>
              <div className="mt-2">
                <MemberBarChart members={data.memberTotals} />
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <p className="text-sm font-semibold text-content">Daily and cumulative trend</p>
            <p className="text-xs text-content-muted">
              Cumulative total reaches{' '}
              {formatINR(cumulative[cumulative.length - 1]?.cumulative_paise ?? 0)}
            </p>
            <div className="mt-2">
              <DailySpendChart dailyTotals={data.dailyTotals} height={260} />
            </div>
          </Card>


          <Card className="overflow-hidden">
            <div className="flex items-end justify-between gap-3 p-4 pb-2">
              <div>
                <p className="text-sm font-semibold text-content">Month over month</p>
                <p className="text-xs text-content-muted">
                  {formatMonthLabel(previousMonthKey(monthKey))} → {formatMonthLabel(monthKey)}
                </p>
              </div>
            </div>
            <div className="hidden lg:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-y border-line">
                    {['Category', 'Last month', 'This month', 'Change', 'Share'].map((heading) => (
                      <th
                        key={heading}
                        className="px-3 py-2 text-left text-2xs font-medium uppercase tracking-[0.06em] text-content-subtle last:text-right"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {movements.map((row) => (
                    <tr key={row.category_id ?? 'uncategorised'}>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <CategoryIcon
                            name={row.category_icon}
                            color={row.category_color}
                            size="sm"
                          />
                          <span className="text-xs text-content">{row.category_name}</span>
                        </span>
                      </td>
                      <td className="num px-3 py-2.5 text-xs text-content-muted">
                        {formatINR(row.previous_paise)}
                      </td>
                      <td className="num px-3 py-2.5 text-xs text-content">
                        {formatINR(row.total_paise)}
                      </td>
                      <td className="num px-3 py-2.5 text-xs">
                        <span
                          className={row.delta_paise > 0 ? 'text-warn' : 'text-content-muted'}
                        >
                          {row.change.defined
                            ? `${row.delta_paise > 0 ? '+' : ''}${formatINR(row.delta_paise)} (${formatPercent(
                                row.change.percent,
                              )})`
                            : row.delta_paise > 0
                              ? `+${formatINR(row.delta_paise)}`
                              : '—'}
                        </span>
                      </td>
                      <td className="num px-3 py-2.5 text-right text-xs text-content-subtle">
                        {formatPercent(
                          data.totals.total_paise > 0
                            ? Math.round((row.total_paise / data.totals.total_paise) * 1000) / 10
                            : null,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line lg:hidden">
              {movements.map((row) => (
                <li key={row.category_id ?? 'uncategorised'} className="flex items-center gap-3 p-3">
                  <CategoryIcon name={row.category_icon} color={row.category_color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-content">{row.category_name}</p>
                    <p className="text-2xs text-content-subtle">
                      Last month {formatINR(row.previous_paise)}
                    </p>
                  </div>
                  <div className="text-right">
                    <Money paise={row.total_paise} className="text-xs font-semibold" />
                    <p
                      className={`text-2xs ${row.delta_paise > 0 ? 'text-warn' : 'text-content-subtle'}`}
                    >
                      {row.delta_paise > 0 ? '+' : ''}
                      {formatINR(row.delta_paise)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

