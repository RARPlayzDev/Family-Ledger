import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingBlock } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/page-header';
import { MonthPicker } from '@/components/shared/month-picker';
import { Money } from '@/components/shared/money';
import { CategoryIcon } from '@/components/shared/category-icon';
import { DailySpendChart } from '@/components/charts/DailySpendChart';
import { CategoryBarChart, CategoryLegend } from '@/components/charts/CategoryBarChart';
import { KpiRow } from '@/features/dashboard/KpiRow';
import { BudgetPulseCard } from '@/features/dashboard/BudgetPulseCard';
import { MemberSpendCard } from '@/features/dashboard/MemberSpendCard';
import { ExpenseList } from '@/features/expenses/ExpenseList';
import { useExpenseComposer } from '@/features/expenses/use-expense-composer';
import { useMonthlyInsights } from '@/hooks/use-analytics';
import { useHousehold } from '@/hooks/use-household';
import { useSession } from '@/hooks/use-session';
import {
  currentMonthKey,
  formatMonthLabel,
  relativeDayLabel,
  todayIsoInTimeZone,
} from '@/domain/dates';
import { withCategoryShares } from '@/domain/analytics';
import { formatINR } from '@/domain/money';
import { errorMessage } from '@/lib/errors';
import type { ExpenseWithRelations } from '@/types/domain';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Household dashboard.
 *
 * Everything here is derived from the shared ledger for one month: totals, the
 * per-day trend, the category split, the per-member split, the budget pulse and
 * the latest activity. All aggregates come from PostgreSQL functions.
 */
export function DashboardPage() {
  const { householdId, householdName, isOwner, timezone } = useHousehold();
  const { displayName } = useSession();
  const composer = useExpenseComposer();
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const today = todayIsoInTimeZone(timezone);

  const insights = useMonthlyInsights(householdId, monthKey);
  const data = insights.data;

  const categoryShares = useMemo(
    () => withCategoryShares(data?.categoryTotals ?? []),
    [data?.categoryTotals],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${greeting()}, ${displayName}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2">
            <span>{householdName ?? 'Your household'}</span>
            <span className="text-content-subtle">·</span>
            <span>{formatMonthLabel(monthKey)}</span>
          </span>
        }
        actions={
          <>
            <MonthPicker value={monthKey} onChange={setMonthKey} />
            <Button onClick={() => composer.openCreate({ date: today })}>
              <Plus />
              <span className="hidden sm:inline">Add expense</span>
            </Button>
          </>
        }
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

      {insights.isLoading || !data ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
          <LoadingBlock label="Crunching the family ledger…" />
        </div>
      ) : (
        <>
          <KpiRow
            totals={data.totals}
            previousTotals={data.previousTotals}
            monthKey={monthKey}
            today={today}
          />

          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex flex-col gap-0.5">
                  <CardTitle>Daily spending</CardTitle>
                  <p className="text-xs text-content-muted">
                    Quiet days are plotted as zero, so gaps in spending stay visible.
                  </p>
                </div>
                <Badge tone="accent">
                  {data.totals.expense_count}{' '}
                  {data.totals.expense_count === 1 ? 'expense' : 'expenses'}
                </Badge>
              </CardHeader>
              <CardContent>
                <DailySpendChart dailyTotals={data.dailyTotals} />
              </CardContent>
            </Card>

            <BudgetPulseCard
              householdId={householdId}
              monthKey={monthKey}
              totalSpentPaise={data.totals.total_paise}
              categoryTotals={data.categoryTotals}
              isOwner={isOwner}
              today={today}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <MemberSpendCard memberTotals={data.memberTotals} />

            <Card>
              <CardHeader>
                <CardTitle>Where the money went</CardTitle>
                <Link to="/app/analytics" className="text-2xs text-accent hover:underline">
                  Full analytics
                </Link>
              </CardHeader>
              <CardContent className="space-y-4">
                <CategoryBarChart categories={categoryShares.slice(0, 6)} />
                <CategoryLegend categories={categoryShares} limit={5} />
              </CardContent>
            </Card>
          </div>


          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Latest activity</CardTitle>
                <Link to="/app/transactions" className="text-2xs text-accent hover:underline">
                  Open ledger
                </Link>
              </CardHeader>
              <CardContent>
                <ExpenseList
                  expenses={data.recentExpenses}
                  emptyTitle="Nothing recorded this month"
                  emptyDescription="Add the first expense of the month and it appears here for the whole family."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-0.5">
                  <CardTitle>Biggest expenses</CardTitle>
                  <p className="text-xs text-content-muted">
                    Ranked by amount in {formatMonthLabel(monthKey, 'MMMM')}.
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                {data.topExpenses.length === 0 ? (
                  <p className="py-6 text-center text-xs text-content-subtle">
                    No expenses recorded yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-line">
                    {data.topExpenses.map((expense: ExpenseWithRelations) => (
                      <li
                        key={expense.id}
                        className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <CategoryIcon
                          name={expense.category?.icon}
                          color={expense.category?.color}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-content">
                            {expense.merchant?.trim() || expense.category?.name || 'Expense'}
                          </p>
                          <p className="text-2xs text-content-subtle">
                            {relativeDayLabel(expense.expense_date)} ·{' '}
                            {expense.spender?.display_name ?? 'Member'}
                          </p>
                        </div>
                        <Money paise={expense.amount_paise} className="text-xs font-semibold" />
                      </li>
                    ))}
                  </ul>
                )}
                <Button variant="ghost" size="sm" asChild className="mt-3 w-full">
                  <Link to="/app/transactions">
                    See every expense
                    <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {data.totals.expense_count === 0 ? (
            <Card className="border-accent/20 bg-accent-soft">
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <Sparkles className="size-4 text-accent" />
                <p className="flex-1 text-xs text-content-muted">
                  {formatMonthLabel(monthKey)} has no expenses yet. Adding one keeps the shared
                  household ledger and budget tracking accurate.
                </p>
                <Button size="sm" onClick={() => composer.openCreate({ date: today })}>
                  <Plus />
                  Add expense
                </Button>
              </CardContent>
            </Card>
          ) : (
            <p className="text-2xs text-content-subtle">
              Month total {formatINR(data.totals.total_paise)} versus{' '}
              {formatINR(data.previousTotals.total_paise)} in the previous month. Average expense{' '}
              {formatINR(data.totals.average_expense_paise, { decimals: 0 })}.
            </p>
          )}
        </>
      )}
    </div>
  );
}

