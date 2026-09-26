import { useMemo, useState } from 'react';
import { Copy, Plus, Trash2, Edit3, PiggyBank, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { MonthPicker } from '@/components/shared/month-picker';
import { Money } from '@/components/shared/money';
import { CategoryIcon } from '@/components/shared/category-icon';
import { useHousehold } from '@/hooks/use-household';
import { useSession } from '@/hooks/use-session';
import { useCategories } from '@/hooks/use-categories';
import { useMonthlyInsights } from '@/hooks/use-analytics';
import {
  useBudgets,
  useSaveBudget,
  useDeleteBudget,
  useCopyBudgets,
} from '@/hooks/use-budgets';
import { useToast } from '@/hooks/use-toast';
import {
  evaluateBudget,
  budgetStateLabel,
  budgetStateTone,
  budgetPace,
  budgetPaceLabel,
  totalCategoryAllocation,
  unplannedSpend,
} from '@/domain/budgets';
import {
  currentMonthKey,
  daysElapsedInMonth,
  daysInMonth,
  formatMonthLabel,
  previousMonthKey,
  todayIsoInTimeZone,
} from '@/domain/dates';
import { formatINR, formatPercent, paiseToRupees, parseRupeeInput } from '@/domain/money';
import { errorMessage } from '@/lib/errors';
import type { BudgetWithCategory } from '@/types/domain';

export function BudgetsPage() {
  const { householdId, isOwner, timezone } = useHousehold();
  const { userId } = useSession();
  const { push: pushToast } = useToast();
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const today = todayIsoInTimeZone(timezone);

  const budgetsQuery = useBudgets(householdId, monthKey);
  const categoriesQuery = useCategories(householdId);
  const insightsQuery = useMonthlyInsights(householdId, monthKey);

  const saveBudgetMutation = useSaveBudget();
  const deleteBudgetMutation = useDeleteBudget();
  const copyBudgetsMutation = useCopyBudgets();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<{
    categoryId: string | null;
    amountRupees: string;
    categoryName?: string;
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<BudgetWithCategory | null>(null);

  const budgets = useMemo(() => budgetsQuery.data ?? [], [budgetsQuery.data]);
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const categoryTotals = useMemo(
    () => insightsQuery.data?.categoryTotals ?? [],
    [insightsQuery.data?.categoryTotals],
  );
  const totalSpentPaise = insightsQuery.data?.totals.total_paise ?? 0;

  const householdBudget = useMemo(
    () => budgets.find((b) => b.category_id === null) ?? null,
    [budgets],
  );

  const categoryBudgets = useMemo(
    () => budgets.filter((b) => b.category_id !== null),
    [budgets],
  );

  const spentByCategory = useMemo(
    () => new Map(categoryTotals.map((c) => [c.category_id ?? '', c])),
    [categoryTotals],
  );

  const householdVerdict = evaluateBudget(householdBudget?.amount_paise ?? null, totalSpentPaise);
  const householdPace = budgetPace(
    householdBudget?.amount_paise ?? null,
    totalSpentPaise,
    daysElapsedInMonth(monthKey, today),
    daysInMonth(monthKey),
  );

  const categoryBudgetRows = useMemo(() => {
    return categoryBudgets.map((b) => {
      const spent = spentByCategory.get(b.category_id ?? '')?.total_paise ?? 0;
      const verdict = evaluateBudget(b.amount_paise, spent);
      return {
        budget: b,
        spent_paise: spent,
        verdict,
      };
    });
  }, [categoryBudgets, spentByCategory]);

  const totalCatAllocation = useMemo(
    () => totalCategoryAllocation(categoryBudgets.map(b => ({ ...b, spent_paise: 0 }))),
    [categoryBudgets],
  );

  const unbudgetedSpend = useMemo(
    () => unplannedSpend(categoryBudgetRows.map(r => ({ ...r.budget, spent_paise: r.spent_paise })), totalSpentPaise),
    [categoryBudgetRows, totalSpentPaise],
  );

  const availableCategoriesForBudget = useMemo(() => {
    const existingCatIds = new Set(categoryBudgets.map((b) => b.category_id));
    return categories.filter((c) => c.is_active && !existingCatIds.has(c.id));
  }, [categories, categoryBudgets]);

  const handleOpenAddCategoryBudget = (categoryId?: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    setEditingBudget({
      categoryId: categoryId ?? (availableCategoriesForBudget[0]?.id ?? null),
      amountRupees: '',
      categoryName: cat?.name,
    });
    setDialogOpen(true);
  };

  const handleOpenEditBudget = (budget: BudgetWithCategory) => {
    setEditingBudget({
      categoryId: budget.category_id,
      amountRupees: String(paiseToRupees(budget.amount_paise)),
      categoryName: budget.category?.name ?? 'Household limit',
    });
    setDialogOpen(true);
  };

  const handleOpenHouseholdBudget = () => {
    setEditingBudget({
      categoryId: null,
      amountRupees: householdBudget ? String(paiseToRupees(householdBudget.amount_paise)) : '',
      categoryName: 'Household limit',
    });
    setDialogOpen(true);
  };
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudget || !householdId || !userId) return;

    const parsedPaise = parseRupeeInput(editingBudget.amountRupees);
    if (parsedPaise === null || parsedPaise <= 0) {
      pushToast({
        title: 'Invalid amount',
        description: 'Please enter a valid rupee amount greater than zero.',
        tone: 'error',
      });
      return;
    }

    try {
      await saveBudgetMutation.mutateAsync({
        householdId,
        categoryId: editingBudget.categoryId,
        amountPaise: parsedPaise,
        periodMonth: monthKey,
        createdBy: userId,
      });
      pushToast({
        title: 'Budget saved',
        description: `Budget updated for ${editingBudget.categoryName ?? 'category'}.`,
        tone: 'success',
      });
      setDialogOpen(false);
      setEditingBudget(null);
    } catch (err) {
      pushToast({
        title: 'Could not save budget',
        description: errorMessage(err),
        tone: 'error',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !householdId) return;
    try {
      await deleteBudgetMutation.mutateAsync({
        budgetId: deleteTarget.id,
        householdId,
      });
      pushToast({
        title: 'Budget removed',
        tone: 'success',
      });
      setDeleteTarget(null);
    } catch (err) {
      pushToast({
        title: 'Could not remove budget',
        description: errorMessage(err),
        tone: 'error',
      });
    }
  };

  const handleCopyFromPreviousMonth = async () => {
    if (!householdId || !userId) return;
    const sourceMonth = previousMonthKey(monthKey);
    try {
      const copied = await copyBudgetsMutation.mutateAsync({
        householdId,
        sourceMonth,
        targetMonth: monthKey,
        createdBy: userId,
      });
      pushToast({
        title: 'Budgets copied',
        description: `Copied ${copied} budget limits from ${formatMonthLabel(sourceMonth)}.`,
        tone: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Could not copy budgets',
        description: errorMessage(err),
        tone: 'error',
      });
    }
  };

  const isLoading = budgetsQuery.isLoading || insightsQuery.isLoading;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Budgets"
        subtitle={`Spending limits for ${formatMonthLabel(monthKey)}`}
        actions={
          <>
            <MonthPicker value={monthKey} onChange={setMonthKey} />
            {isOwner && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyFromPreviousMonth}
                  loading={copyBudgetsMutation.isPending}
                  title="Copy budget limits from previous month"
                >
                  <Copy />
                  <span className="hidden sm:inline">Copy previous</span>
                </Button>
                <Button size="sm" onClick={() => handleOpenAddCategoryBudget()}>
                  <Plus />
                  <span className="hidden sm:inline">Category budget</span>
                </Button>
              </>
            )}
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-44 w-full" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      ) : (
        <>
          <Card className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-content">Household monthly limit</h3>
                  <Badge tone={budgetStateTone(householdVerdict.state)}>
                    {budgetStateLabel(householdVerdict.state)}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-content-muted">
                  Overall safety ceiling for the entire household. Independent of category limits.
                </p>
              </div>
              {isOwner && (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={handleOpenHouseholdBudget}>
                    <Edit3 />
                    {householdBudget ? 'Adjust limit' : 'Set limit'}
                  </Button>
                  {householdBudget && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(householdBudget)}
                      title="Remove household budget"
                    >
                      <Trash2 className="text-danger" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {householdBudget ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <Money paise={totalSpentPaise} className="text-2xl font-bold" />
                    <span className="text-xs text-content-muted">
                      {' '}
                      spent of {formatINR(householdBudget.amount_paise)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-content">
                      {householdVerdict.remaining_paise !== null &&
                      householdVerdict.remaining_paise >= 0 ? (
                        <>{formatINR(householdVerdict.remaining_paise)} left</>
                      ) : (
                        <span className="text-danger">
                          +{formatINR(householdVerdict.overspend_paise)} over
                        </span>
                      )}
                    </span>
                    <p className="text-2xs text-content-subtle">
                      {formatPercent(householdVerdict.utilization_percent)} used
                    </p>
                  </div>
                </div>

                <Progress
                  value={householdVerdict.utilization_percent ?? 0}
                  tone={
                    householdVerdict.state === 'exceeded'
                      ? 'danger'
                      : householdVerdict.state === 'warning'
                        ? 'warn'
                        : 'accent'
                  }
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-content-muted">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-accent" />
                    {budgetPaceLabel(householdPace)}
                  </span>
                  <span>
                    Day {daysElapsedInMonth(monthKey, today)} of {daysInMonth(monthKey)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-line p-6 text-center">
                <PiggyBank className="size-8 text-content-subtle" />
                <p className="mt-2 text-sm font-medium text-content">No overall limit set</p>
                <p className="max-w-md text-xs text-content-muted">
                  Set a monthly budget for the entire household to receive warning alerts and pace
                  tracking.
                </p>
                {isOwner && (
                  <Button size="sm" className="mt-3" onClick={handleOpenHouseholdBudget}>
                    <Plus /> Set household limit
                  </Button>
                )}
              </div>
            )}
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <p className="label-caps">Total category limits</p>
              <p className="mt-1 text-xl font-semibold">
                <Money paise={totalCatAllocation} />
              </p>
              <p className="mt-1 text-2xs text-content-muted">
                {categoryBudgets.length}{' '}
                {categoryBudgets.length === 1 ? 'category has' : 'categories have'} dedicated limits
              </p>
            </Card>

            <Card className="p-4">
              <p className="label-caps">Unbudgeted category spend</p>
              <p className="mt-1 text-xl font-semibold">
                <Money paise={unbudgetedSpend ?? 0} />
              </p>
              <p className="mt-1 text-2xs text-content-muted">
                {unbudgetedSpend && unbudgetedSpend > 0 ? (
                  <span className="flex items-center gap-1 text-warn">
                    <AlertTriangle className="size-3" />
                    Spent in categories without a dedicated limit
                  </span>
                ) : (
                  'All category spending is budgeted'
                )}
              </p>
            </Card>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-content">Category budgets</h3>
                <p className="text-xs text-content-muted">
                  Detailed spending targets across individual categories
                </p>
              </div>
              {isOwner && availableCategoriesForBudget.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleOpenAddCategoryBudget()}
                >
                  <Plus /> Add category limit
                </Button>
              )}
            </div>

            {categoryBudgetRows.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-xs text-content-muted">
                  No category budgets created for this month.
                </p>
                {isOwner && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    onClick={() => handleOpenAddCategoryBudget()}
                  >
                    <Plus /> Add the first category budget
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categoryBudgetRows.map(({ budget, spent_paise, verdict }) => (
                  <Card key={budget.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CategoryIcon
                          name={budget.category?.icon}
                          color={budget.category?.color}
                          size="md"
                        />
                        <div>
                          <p className="text-xs font-semibold text-content">
                            {budget.category?.name ?? 'Category'}
                          </p>
                          <p className="text-2xs text-content-muted">
                            Budget: {formatINR(budget.amount_paise)}
                          </p>
                        </div>
                      </div>
                      <Badge tone={budgetStateTone(verdict.state)}>
                        {budgetStateLabel(verdict.state)}
                      </Badge>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-semibold text-content">
                          {formatINR(spent_paise)}
                        </span>
                        <span className="text-content-muted">
                          {verdict.remaining_paise !== null && verdict.remaining_paise >= 0 ? (
                            `${formatINR(verdict.remaining_paise)} left`
                          ) : (
                            <span className="text-danger">
                              +{formatINR(verdict.overspend_paise)} over
                            </span>
                          )}
                        </span>
                      </div>
                      <Progress
                        value={verdict.utilization_percent ?? 0}
                        tone={
                          verdict.state === 'exceeded'
                            ? 'danger'
                            : verdict.state === 'warning'
                              ? 'warn'
                              : 'accent'
                        }
                      />
                      <p className="text-right text-2xs text-content-subtle">
                        {formatPercent(verdict.utilization_percent)} used
                      </p>
                    </div>

                    {isOwner && (
                      <div className="mt-3 flex items-center justify-end gap-1 border-t border-line pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditBudget(budget)}
                        >
                          <Edit3 className="size-3.5" />
                          <span className="text-2xs">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(budget)}
                        >
                          <Trash2 className="size-3.5 text-danger" />
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBudget?.categoryId === null
                ? 'Set household limit'
                : 'Set category budget'}
            </DialogTitle>
            <DialogDescription>
              {editingBudget?.categoryId === null
                ? `Enter the total spending cap for the family in ${formatMonthLabel(monthKey)}.`
                : `Set a monthly limit for this category in ${formatMonthLabel(monthKey)}.`}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            {editingBudget?.categoryId !== null && (
              <div className="space-y-1.5">
                <Label htmlFor="budget-category">Category</Label>
                <select
                  id="budget-category"
                  value={editingBudget?.categoryId ?? ''}
                  onChange={(e) => {
                    const cat = categories.find((c) => c.id === e.target.value);
                    setEditingBudget((prev) =>
                      prev
                        ? { ...prev, categoryId: e.target.value, categoryName: cat?.name }
                        : null,
                    );
                  }}
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-content focus:border-accent focus:outline-none"
                  disabled={Boolean(
                    categoryBudgets.some((b) => b.category_id === editingBudget?.categoryId),
                  )}
                >
                  {categoryBudgets.some((b) => b.category_id === editingBudget?.categoryId) ? (
                    <option value={editingBudget?.categoryId ?? ''}>
                      {editingBudget?.categoryName ?? 'Current category'}
                    </option>
                  ) : (
                    availableCategoriesForBudget.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="budget-amount">Monthly limit (₹)</Label>
              <Input
                id="budget-amount"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 15,000"
                value={editingBudget?.amountRupees ?? ''}
                onChange={(e) =>
                  setEditingBudget((prev) =>
                    prev ? { ...prev, amountRupees: e.target.value } : null,
                  )
                }
                autoFocus
              />
              <p className="text-2xs text-content-subtle">
                Enter an amount in Indian Rupees. We store exact paise integers under the hood.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDialogOpen(false);
                  setEditingBudget(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={saveBudgetMutation.isPending}>
                Save limit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove spending limit?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.category_id === null
                ? 'This will remove the household monthly budget limit. Spending history remains intact.'
                : `This will remove the monthly budget for ${deleteTarget?.category?.name ?? 'this category'}. Recorded transactions are not affected.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-danger text-white hover:bg-danger/90"
            >
              Remove limit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

