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
  const supabase = getSupabase();

  const conflictQuery = supabase
    .from('budgets')
    .select('id')
    .eq('household_id', input.householdId)
    .eq('period_month', input.periodMonth);

  const { data: existing, error: lookupError } = await (input.categoryId === null
    ? conflictQuery.is('category_id', null)
    : conflictQuery.eq('category_id', input.categoryId)
  ).maybeSingle();

  if (lookupError) throw lookupError;

  if (existing) {
    const { data, error } = await supabase
      .from('budgets')
      .update({ amount_paise: input.amountPaise })
      .eq('id', existing.id)
      .select(BUDGET_SELECT)
      .single()
      .returns<BudgetWithCategory>();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('budgets')
    .insert({
      household_id: input.householdId,
      category_id: input.categoryId,
      amount_paise: input.amountPaise,
      period_month: input.periodMonth,
      created_by: input.createdBy,
    })
    .select(BUDGET_SELECT)
    .single()
    .returns<BudgetWithCategory>();
  if (error) throw error;
  return data;
}

export async function deleteBudget(budgetId: string): Promise<void> {
  const { error } = await getSupabase().from('budgets').delete().eq('id', budgetId);
  if (error) throw error;
}

export async function clearBudgetForCategory(
  householdId: string,
  periodMonth: string,
  categoryId: string | null,
): Promise<void> {
  const supabase = getSupabase();
  const base = supabase
    .from('budgets')
    .delete()
    .eq('household_id', householdId)
    .eq('period_month', periodMonth);
  const { error } = await (categoryId === null
    ? base.is('category_id', null)
    : base.eq('category_id', categoryId));
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
