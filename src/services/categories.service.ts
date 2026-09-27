import { getSupabase } from '@/lib/supabase';
import type { Category } from '@/types/domain';
import type { CategoryRow } from '@/types/database';

/**
 * Categories: the shared system defaults (household_id IS NULL) plus the
 * household's own categories. Only the household owner can create, rename,
 * archive or delete a household category (enforced by RLS).
 */

const CATEGORY_SELECT = 'id, household_id, name, icon, color, is_active, created_by, created_at';

function toDomain(row: CategoryRow): Category {
  return { ...row, is_system: row.household_id === null };
}

export async function listCategories(householdId: string): Promise<Category[]> {
  const { data, error } = await getSupabase()
    .from('categories')
    .select(CATEGORY_SELECT)
    .or(`household_id.is.null,household_id.eq.${householdId}`)
    .order('name', { ascending: true })
    .returns<CategoryRow[]>();
  if (error) throw error;
  return (data ?? []).map(toDomain);
}

export async function createCategory(input: {
  householdId: string;
  name: string;
  icon: string;
  color: string;
  createdBy: string;
}): Promise<Category> {
  // createdBy is derived from the session server-side; the argument is kept
  // only so the call site reads consistently with the other write helpers.
  void input.createdBy;
  const { data: categoryId, error } = await getSupabase().rpc('create_category', {
    p_household_id: input.householdId,
    p_name: input.name,
    p_icon: input.icon,
    p_color: input.color,
  });
  if (error) throw error;

  const { data, error: readError } = await getSupabase()
    .from('categories')
    .select(CATEGORY_SELECT)
    .eq('id', categoryId)
    .single();
  if (readError) throw readError;
  return toDomain(data);
}

export async function updateCategory(
  categoryId: string,
  changes: { name?: string; icon?: string; color?: string; is_active?: boolean },
): Promise<Category> {
  const payload: { name?: string; icon?: string; color?: string; is_active?: boolean } = {};
  if (changes.name !== undefined) payload.name = changes.name.trim();
  if (changes.icon !== undefined) payload.icon = changes.icon;
  if (changes.color !== undefined) payload.color = changes.color;
  if (changes.is_active !== undefined) payload.is_active = changes.is_active;

  const { error } = await getSupabase().rpc('update_category', {
    p_category_id: categoryId,
    p_name: changes.name ?? null,
    p_icon: changes.icon ?? null,
    p_color: changes.color ?? null,
    p_is_active: changes.is_active ?? null,
  });
  if (error) throw error;

  const { data, error: readError } = await getSupabase()
    .from('categories')
    .select(CATEGORY_SELECT)
    .eq('id', categoryId)
    .single();
  if (readError) throw readError;
  return toDomain(data);
}

/**
 * Categories are archived rather than deleted once expenses reference them:
 * `is_active = false` hides them from new expenses while history keeps its label.
 */
export async function setCategoryArchived(categoryId: string, archived: boolean): Promise<void> {
  const { error } = await getSupabase().rpc('update_category', {
    p_category_id: categoryId,
    p_name: null,
    p_icon: null,
    p_color: null,
    p_is_active: !archived,
  });
  if (error) throw error;
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const { error } = await getSupabase().rpc('delete_category', { p_category_id: categoryId });
  if (error) throw error;
}

export function indexCategories(categories: readonly Category[]): Map<string, Category> {
  return new Map(categories.map((category) => [category.id, category]));
}

export function activeSelectableCategories(categories: readonly Category[]): Category[] {
  return categories.filter((category) => category.is_active);
}
