import { getSupabase } from '@/lib/supabase';
import type {
  CategoryTotal,
  DailyTotal,
  ExpenseQueryFilters,
  ExpenseSortKey,
  ExpenseWithRelations,
  MemberTotal,
  PeriodTotals,
} from '@/types/domain';
import { DEFAULT_PAGE_SIZE, type Page } from '@/domain/expenses';
import type { PaymentMethod } from '@/types/database';

/**
 * The household ledger.
 *
 * Reads always join the category and the member profile in one round trip; the
 * household scoping is enforced by RLS (not by the client), so the `household_id`
 * filter here is only an optimisation.
 */

const EXPENSE_SELECT = [
  'id',
  'household_id',
  'spent_by',
  'category_id',
  'amount_paise',
  'expense_date',
  'merchant',
  'note',
  'payment_method',
  'created_at',
  'updated_at',
  'category:categories(id, name, icon, color)',
  'spender:profiles!expenses_spent_by_fkey(id, display_name, avatar_url)',
].join(', ');

/** Removes characters that would break the PostgREST `or=` filter grammar. */
function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[,()"'*%\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type ListExpensesParams = {
  householdId: string;
  filters: ExpenseQueryFilters;
  sort?: ExpenseSortKey;
  page?: number;
  pageSize?: number;
};

export type ExpensePage = Page<ExpenseWithRelations>;

/** Server-side filtered, sorted and range-paginated ledger page. */
export async function listExpenses(params: ListExpensesParams): Promise<ExpensePage> {
  const { householdId, filters } = params;
  const sort = params.sort ?? 'date_desc';
  const page = Math.max(params.page ?? 1, 1);
  const pageSize = Math.max(params.pageSize ?? DEFAULT_PAGE_SIZE, 1);

  let query = getSupabase()
    .from('expenses')
    .select(EXPENSE_SELECT, { count: 'exact' })
    .eq('household_id', householdId)
    .gte('expense_date', filters.from)
    .lte('expense_date', filters.to);

  if (filters.categoryIds && filters.categoryIds.length > 0) {
    query = query.in('category_id', filters.categoryIds);
  }
  if (filters.memberIds && filters.memberIds.length > 0) {
    query = query.in('spent_by', filters.memberIds);
  }
  if (filters.paymentMethods && filters.paymentMethods.length > 0) {
    query = query.in('payment_method', filters.paymentMethods);
  }
  if (typeof filters.minPaise === 'number') {
    query = query.gte('amount_paise', filters.minPaise);
  }
  if (typeof filters.maxPaise === 'number') {
    query = query.lte('amount_paise', filters.maxPaise);
  }

  const searchTerm = filters.search ? sanitizeSearchTerm(filters.search) : '';
  if (searchTerm.length > 0) {
    query = query.or(`merchant.ilike.%${searchTerm}%,note.ilike.%${searchTerm}%`);
  }

  // Transform methods (order/range) are applied last so the builder type stays
  // consistent across the conditional filter reassignments above.
  const ordered = (() => {
    switch (sort) {
      case 'date_asc':
        return query
          .order('expense_date', { ascending: true })
          .order('created_at', { ascending: true });
      case 'amount_desc':
        return query
          .order('amount_paise', { ascending: false })
          .order('created_at', { ascending: false });
      case 'amount_asc':
        return query
          .order('amount_paise', { ascending: true })
          .order('created_at', { ascending: false });
      case 'date_desc':
      default:
        return query
          .order('expense_date', { ascending: false })
          .order('created_at', { ascending: false });
    }
  })();

  const from = (page - 1) * pageSize;
  const { data, error, count } = await ordered
    .range(from, from + pageSize - 1)
    .returns<ExpenseWithRelations[]>();

  if (error) throw error;

  const total = count ?? 0;
  return {
    items: data ?? [],
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
  };
}

/** Unpaginated fetch for exports, member pages and small date windows. */
export async function listExpensesInRange(params: {
  householdId: string;
  from: string;
  to: string;
  memberId?: string;
  limit?: number;
}): Promise<ExpenseWithRelations[]> {
  let query = getSupabase()
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('household_id', params.householdId)
    .gte('expense_date', params.from)
    .lte('expense_date', params.to);

  if (params.memberId) {
    query = query.eq('spent_by', params.memberId);
  }

  const { data, error } = await query
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 1000)
    .returns<ExpenseWithRelations[]>();

  if (error) throw error;
  return data ?? [];
}

/**
 * Top spenders of a period, ordered by amount (server-side ORDER BY + LIMIT).
 * Using a dedicated query keeps the "largest expenses" card correct even when a
 * month has more rows than the recent-activity window.
 */
export async function listTopExpenses(params: {
  householdId: string;
  from: string;
  to: string;
  limit?: number;
}): Promise<ExpenseWithRelations[]> {
  const { data, error } = await getSupabase()
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('household_id', params.householdId)
    .gte('expense_date', params.from)
    .lte('expense_date', params.to)
    .order('amount_paise', { ascending: false })
    .limit(params.limit ?? 5)
    .returns<ExpenseWithRelations[]>();
  if (error) throw error;
  return data ?? [];
}

export async function getExpense(expenseId: string): Promise<ExpenseWithRelations | null> {
  const { data, error } = await getSupabase()
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('id', expenseId)
    .maybeSingle()
    .returns<ExpenseWithRelations | null>();
  if (error) throw error;
  return data ?? null;
}

export type ExpenseWriteInput = {
  householdId: string;
  spentBy: string;
  amountPaise: number;
  expenseDate: string;
  categoryId: string | null;
  merchant: string | null;
  note: string | null;
  paymentMethod: PaymentMethod;
};

export async function createExpense(input: ExpenseWriteInput): Promise<ExpenseWithRelations> {
  const { data: expenseId, error } = await getSupabase().rpc('create_expense', {
    p_household_id: input.householdId,
    p_spent_by: input.spentBy,
    p_amount_paise: input.amountPaise,
    p_expense_date: input.expenseDate,
    p_category_id: input.categoryId,
    p_merchant: input.merchant,
    p_note: input.note,
    p_payment_method: input.paymentMethod,
  });
  if (error) throw error;

  const { data, error: readError } = await getSupabase()
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('id', expenseId)
    .single()
    .returns<ExpenseWithRelations>();
  if (readError) throw readError;
  return data;
}

export async function updateExpense(
  expenseId: string,
  input: Omit<ExpenseWriteInput, 'householdId'>,
): Promise<ExpenseWithRelations> {
  const { error } = await getSupabase().rpc('update_expense', {
    p_expense_id: expenseId,
    p_spent_by: input.spentBy,
    p_amount_paise: input.amountPaise,
    p_expense_date: input.expenseDate,
    p_category_id: input.categoryId,
    p_merchant: input.merchant,
    p_note: input.note,
    p_payment_method: input.paymentMethod,
  });
  if (error) throw error;

  const { data, error: readError } = await getSupabase()
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('id', expenseId)
    .single()
    .returns<ExpenseWithRelations>();
  if (readError) throw readError;
  return data;
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const { error } = await getSupabase().rpc('delete_expense', { p_expense_id: expenseId });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Aggregations: computed in PostgreSQL (see the household_*_totals functions), so
// RLS decides what is visible and the browser never downloads a whole ledger in
// order to sum it.
// ---------------------------------------------------------------------------

export async function getPeriodTotals(
  householdId: string,
  from: string,
  to: string,
): Promise<PeriodTotals> {
  const { data, error } = await getSupabase().rpc('household_period_totals', {
    p_household_id: householdId,
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  const row = (data ?? [])[0];
  return (
    row ?? {
      total_paise: 0,
      expense_count: 0,
      member_count: 0,
      largest_expense_paise: 0,
      average_expense_paise: 0,
    }
  );
}

export async function getCategoryTotals(
  householdId: string,
  from: string,
  to: string,
): Promise<CategoryTotal[]> {
  const { data, error } = await getSupabase().rpc('household_category_totals', {
    p_household_id: householdId,
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return data ?? [];
}

export async function getMemberTotals(
  householdId: string,
  from: string,
  to: string,
): Promise<MemberTotal[]> {
  const { data, error } = await getSupabase().rpc('household_member_totals', {
    p_household_id: householdId,
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return data ?? [];
}

export async function getDailyTotals(
  householdId: string,
  from: string,
  to: string,
): Promise<DailyTotal[]> {
  const { data, error } = await getSupabase().rpc('household_daily_totals', {
    p_household_id: householdId,
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return data ?? [];
}

