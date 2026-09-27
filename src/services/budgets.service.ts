import { getSupabase } from '@/lib/supabase';
import type { BudgetWithCategory } from '@/types/domain';

/**
 * Monthly budgets. Owner-only for writes (RLS), readable by every member so the
 * whole family can see how the month is tracking.
 *
 * The unique index uses coalesce(category_id), which PostgREST cannot target with
 * `upsert(onConflict:)`, so saving is an explicit select-then-write. The database
 * index remains the real guard against duplicates.
 */

const BUDGET_SELECT = [
  'id',
  'household_id',
  'category_id',
  'amount_paise',
  'period_month',
  'created_by',
  'created_at',
  'updated_at',
  'category:categories(id, name, icon, color)',
].join(', ');

export async function listBudgets(
  householdId: string,
  periodMonth: string,
): Promise<BudgetWithCategory[]> {
  const { data, error } = await getSupabase()
    .from('budgets')
    .select(BUDGET_SELECT)
    .eq('household_id', householdId)
    .eq('period_month', periodMonth)
    .order('amount_paise', { ascending: false })
    .returns<BudgetWithCategory[]>();
  if (error) throw error;
  return data ?? [];
}

export type BudgetInput = {
  householdId: string;
  categoryId: string | null;
  amountPaise: number;
  periodMonth: string;
  createdBy: string;
};

export async function saveBudget(input: BudgetInput): Promise<BudgetWithCategory> {
  // created_by is derived from the session server-side.
  void input.createdBy;
  const { data: budgetId, error } = await getSupabase().rpc('upsert_budget', {
    p_household_id: input.householdId,
    p_category_id: input.categoryId,
    p_amount_paise: input.amountPaise,
    p_period_month: input.periodMonth,
  });
  if (error) throw error;

  const { data, error: readError } = await getSupabase()
    .from('budgets')
    .select(BUDGET_SELECT)
    .eq('id', budgetId)
    .single()
    .returns<BudgetWithCategory>();
  if (readError) throw readError;
  return data;
}

export async function deleteBudget(budgetId: string): Promise<void> {
  const { error } = await getSupabase().rpc('delete_budget', { p_budget_id: budgetId });
  if (error) throw error;
}

export async function clearBudgetForCategory(
  householdId: string,
  periodMonth: string,
  categoryId: string | null,
): Promise<void> {
  const { error } = await getSupabase().rpc('clear_budget', {
    p_household_id: householdId,
    p_period_month: periodMonth,
    p_category_id: categoryId,
  });
  if (error) throw error;
}

/** Copies last month's limits into an empty month so nobody re-keys them. */
export async function copyBudgetsFromMonth(
  householdId: string,
  sourceMonth: string,
  targetMonth: string,
  createdBy: string,
): Promise<number> {
  const source = await listBudgets(householdId, sourceMonth);
  if (source.length === 0) return 0;

  const existing = await listBudgets(householdId, targetMonth);
  const existingKeys = new Set(existing.map((budget) => budget.category_id ?? 'household'));

  let copied = 0;
  for (const budget of source) {
    const key = budget.category_id ?? 'household';
    if (existingKeys.has(key)) continue;
    await saveBudget({
      householdId,
      categoryId: budget.category_id,
      amountPaise: budget.amount_paise,
      periodMonth: targetMonth,
      createdBy,
    });
    copied += 1;
  }
  return copied;
}
