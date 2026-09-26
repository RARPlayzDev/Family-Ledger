import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/shared/money';
import { useBudgets } from '@/hooks/use-budgets';
import {
  budgetPace,
  budgetPaceLabel,
  budgetStateLabel,
  budgetStateTone,
  evaluateBudget,
} from '@/domain/budgets';
import { daysElapsedInMonth, daysInMonth } from '@/domain/dates';
import { formatINR, formatPercent } from '@/domain/money';
import type { CategoryTotal } from '@/types/domain';

/**
 * Household budget pulse.
 *
 * The household limit and the category limits are evaluated independently: adding
 * the category limits together would double count the same rupees and is the most
 * common budget bug, so this card never does it.
 */
export function BudgetPulseCard({
  householdId,
  monthKey,
  totalSpentPaise,
  categoryTotals,
  isOwner,
  today,
}: {
  householdId: string | null;
  monthKey: string;
  totalSpentPaise: number;
  categoryTotals: CategoryTotal[];
  isOwner: boolean;
  today: string;
}) {
  const budgetsQuery = useBudgets(householdId, monthKey);
  const budgets = budgetsQuery.data ?? [];

  const householdBudget = budgets.find((budget) => budget.category_id === null) ?? null;
  const categoryBudgets = budgets.filter((budget) => budget.category_id !== null);
  const spentByCategory = new Map(categoryTotals.map((row) => [row.category_id ?? '', row]));

  const verdict = evaluateBudget(householdBudget?.amount_paise ?? null, totalSpentPaise);
  const pace = budgetPace(
    householdBudget?.amount_paise ?? null,
    totalSpentPaise,
    daysElapsedInMonth(monthKey, today),
    daysInMonth(monthKey),
  );

  const exceededCategories = categoryBudgets.filter((budget) => {
    const spent = spentByCategory.get(budget.category_id ?? '')?.total_paise ?? 0;
    return evaluateBudget(budget.amount_paise, spent).state === 'exceeded';
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-0.5">
          <CardTitle>Budget pulse</CardTitle>
          <p className="text-xs text-content-muted">
            {householdBudget
              ? `${budgetStateLabel(verdict.state)} · ${budgetPaceLabel(pace)}`
              : 'No household budget set for this month'}
          </p>
        </div>
        <Badge tone={budgetStateTone(verdict.state)}>
          {householdBudget ? budgetStateLabel(verdict.state) : 'Not set'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {householdBudget ? (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <Money paise={totalSpentPaise} className="text-base font-semibold" />
              <span className="text-xs text-content-muted">
                of {formatINR(householdBudget.amount_paise)}
              </span>
            </div>
            <Progress
              value={verdict.utilization_percent ?? 0}
              tone={
                verdict.state === 'exceeded' ? 'danger' : verdict.state === 'warning' ? 'warn' : 'accent'
              }
            />
            <p className="text-xs text-content-muted">
              {verdict.remaining_paise !== null && verdict.remaining_paise >= 0 ? (
                <>
                  <span className="text-content">{formatINR(verdict.remaining_paise)}</span> left ·{' '}
                  {formatPercent(verdict.utilization_percent)} used
                </>
              ) : (
                <>
                  Over by <span className="text-danger">{formatINR(verdict.overspend_paise)}</span>
                </>
              )}
            </p>
          </>
        ) : (
          <p className="text-xs leading-relaxed text-content-muted">
            Set a monthly limit to see how the family is tracking. Category limits are evaluated
            separately from the household limit.
          </p>
        )}

        {exceededCategories.length > 0 ? (
          <div className="rounded-md border border-danger/30 bg-danger-soft p-2.5">
            <p className="text-2xs font-medium uppercase tracking-[0.06em] text-danger">
              Over their category limit
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-content">
              {exceededCategories.slice(0, 3).map((budget) => (
                <li key={budget.id} className="flex justify-between gap-2">
                  <span className="truncate">{budget.category?.name ?? 'Category'}</span>
                  <span className="num shrink-0 text-danger">
                    {formatINR(spentByCategory.get(budget.category_id ?? '')?.total_paise ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Button variant="secondary" size="sm" asChild className="w-full">
          <Link to="/app/budgets">{isOwner ? 'Manage budgets' : 'View budgets'}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
