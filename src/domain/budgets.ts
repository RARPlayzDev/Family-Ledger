/**
 * Budget evaluation.
 *
 * A budget is a LIMIT for one month, not a balance: nothing is carried over and
 * the household-wide limit is deliberately NOT the sum of the category limits
 * (double counting is the most common bug in budget UIs). Category budgets are
 * therefore evaluated independently of the household total.
 */
import type { BudgetRow, CategorySummary, CategoryBudgetRow } from '@/types/domain';

/** Spend at or above this share of the limit is flagged as a warning. */
export const BUDGET_WARNING_RATIO = 0.8;

export type BudgetState = 'unset' | 'on_track' | 'warning' | 'exceeded';

export type BudgetVerdict = {
  allocated_paise: number | null;
  spent_paise: number;
  /** null when no limit is set. */
  remaining_paise: number | null;
  /** null when no limit is set; otherwise 0..n percent. */
  utilization_percent: number | null;
  /** Amount spent beyond the limit (0 while within budget). */
  overspend_paise: number;
  state: BudgetState;
};

export function evaluateBudget(
  allocatedPaise: number | null | undefined,
  spentPaise: number,
): BudgetVerdict {
  const spent = Math.max(Math.trunc(spentPaise), 0);

  if (allocatedPaise === null || allocatedPaise === undefined || allocatedPaise <= 0) {
    return {
      allocated_paise: null,
      spent_paise: spent,
      remaining_paise: null,
      utilization_percent: null,
      overspend_paise: 0,
      state: 'unset',
    };
  }

  const allocated = Math.trunc(allocatedPaise);
  const remaining = allocated - spent;
  const utilization = Math.round((spent / allocated) * 1000) / 10;

  let state: BudgetState = 'on_track';
  if (spent > allocated) state = 'exceeded';
  else if (spent >= allocated * BUDGET_WARNING_RATIO) state = 'warning';

  return {
    allocated_paise: allocated,
    spent_paise: spent,
    remaining_paise: remaining,
    utilization_percent: utilization,
    overspend_paise: remaining < 0 ? -remaining : 0,
    state,
  };
}

export function budgetStateLabel(state: BudgetState): string {
  switch (state) {
    case 'unset':
      return 'No budget set';
    case 'on_track':
      return 'On track';
    case 'warning':
      return 'Approaching limit';
    case 'exceeded':
      return 'Over budget';
  }
}

export type BudgetTone = 'neutral' | 'accent' | 'warn' | 'danger';

export function budgetStateTone(state: BudgetState): BudgetTone {
  switch (state) {
    case 'unset':
      return 'neutral';
    case 'on_track':
      return 'accent';
    case 'warning':
      return 'warn';
    case 'exceeded':
      return 'danger';
  }
}


/**
 * Joins stored budgets with the actual spend per category for the month.
 * Categories with spend but no budget are included so the owner can see what is
 * unplanned, ordered by spend so the page stays useful.
 */
export function buildCategoryBudgetRows(
  budgets: readonly BudgetRow[],
  spentByCategory: ReadonlyMap<string, { total_paise: number; expense_count: number }>,
  categoriesById: ReadonlyMap<string, CategorySummary>,
  options: { includeUnbudgeted?: boolean } = {},
): CategoryBudgetRow[] {
  const rows: CategoryBudgetRow[] = budgets
    .filter((budget) => budget.category_id !== null)
    .map((budget) => {
      const categoryId = budget.category_id ?? '';
      return {
        ...budget,
        category: categoriesById.get(categoryId) ?? null,
        spent_paise: spentByCategory.get(categoryId)?.total_paise ?? 0,
      };
    });

  const reference = budgets[0];
  const budgetedCategoryIds = new Set(rows.map((row) => row.category_id));

  if (options.includeUnbudgeted && reference) {
    for (const [categoryId, spent] of spentByCategory) {
      if (budgetedCategoryIds.has(categoryId) || spent.total_paise <= 0) continue;
      const summary = categoriesById.get(categoryId);
      if (!summary) continue;
      rows.push({
        id: `unbudgeted:${categoryId}`,
        household_id: reference.household_id,
        category_id: categoryId,
        amount_paise: 0,
        period_month: reference.period_month,
        created_by: reference.created_by,
        created_at: reference.created_at,
        updated_at: reference.updated_at,
        category: summary,
        spent_paise: spent.total_paise,
      });
    }
  }

  return rows.sort((a, b) => {
    const aRatio = a.amount_paise > 0 ? a.spent_paise / a.amount_paise : Number.POSITIVE_INFINITY;
    const bRatio = b.amount_paise > 0 ? b.spent_paise / b.amount_paise : Number.POSITIVE_INFINITY;
    if (bRatio !== aRatio) return bRatio - aRatio;
    return b.spent_paise - a.spent_paise;
  });
}

/** Sum of the category limits only (never mixed with the household limit). */
export function totalCategoryAllocation(rows: readonly CategoryBudgetRow[]): number {
  return rows.reduce((sum, row) => sum + (row.category_id ? row.amount_paise : 0), 0);
}

/**
 * Spend that no category budget covers. Only meaningful when at least one
 * category budget exists; otherwise null (everything is unplanned).
 */
export function unplannedSpend(
  rows: readonly CategoryBudgetRow[],
  totalSpentPaise: number,
): number | null {
  if (rows.length === 0) return null;
  const planned = rows.reduce((sum, row) => sum + row.spent_paise, 0);
  return Math.max(totalSpentPaise - planned, 0);
}

/** Straight-line projection of the month total based on elapsed days. */
export function projectMonthEndSpend(
  spentPaise: number,
  daysElapsed: number,
  daysInMonth: number,
): number {
  if (daysElapsed <= 0 || daysInMonth <= 0) return spentPaise;
  return Math.round((spentPaise / daysElapsed) * daysInMonth);
}

export type BudgetPace = 'ahead' | 'behind' | 'on_pace' | 'unknown';

/**
 * Compares the straight-line projection with the limit.
 * 'behind' is good news: the month is on course to finish under budget.
 */
export function budgetPace(
  allocatedPaise: number | null | undefined,
  spentPaise: number,
  daysElapsed: number,
  daysInMonth: number,
): BudgetPace {
  if (!allocatedPaise || allocatedPaise <= 0 || daysElapsed <= 0 || daysInMonth <= 0) {
    return 'unknown';
  }
  const projected = projectMonthEndSpend(spentPaise, daysElapsed, daysInMonth);
  const tolerance = allocatedPaise * 0.05;
  if (projected > allocatedPaise + tolerance) return 'ahead';
  if (projected < allocatedPaise - tolerance) return 'behind';
  return 'on_pace';
}

export function budgetPaceLabel(pace: BudgetPace): string {
  switch (pace) {
    case 'ahead':
      return 'Projected to exceed the limit';
    case 'behind':
      return 'Projected to finish under the limit';
    case 'on_pace':
      return 'Tracking close to the limit';
    case 'unknown':
      return 'Not enough data to project';
  }
}

