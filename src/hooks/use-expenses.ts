import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import { DEFAULT_PAGE_SIZE } from '@/domain/expenses';
import {
  createExpense,
  deleteExpense,
  getPeriodTotals,
  listExpenses,
  listExpensesInRange,
  listTopExpenses,
  updateExpense,
  type ExpenseWriteInput,
} from '@/services/expenses.service';
import type { ExpenseQueryFilters, ExpenseSortKey } from '@/types/domain';

/**
 * Ledger hooks.
 *
 * Every mutation invalidates the whole household namespace (`['expenses', id]`)
 * rather than patching the cache by hand: the dashboard, analytics and budget
 * pages are all views over the same rows, so a targeted patch would leave
 * different screens disagreeing with each other.
 */
export function invalidateLedgerData(queryClient: QueryClient, householdId: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.expenses(householdId) });
  void queryClient.invalidateQueries({ queryKey: ['monthly-insights', householdId] });
  void queryClient.invalidateQueries({ queryKey: ['member-insights', householdId] });
  void queryClient.invalidateQueries({ queryKey: ['budgets', householdId] });
}

export function useExpensePage(params: {
  householdId: string | null;
  filters: ExpenseQueryFilters;
  sort: ExpenseSortKey;
  page: number;
  pageSize?: number;
}) {
  const { householdId, filters, sort, page, pageSize = DEFAULT_PAGE_SIZE } = params;

  return useQuery({
    queryKey: queryKeys.expenseList(householdId ?? 'none', filters, sort, page),
    queryFn: () =>
      listExpenses({
        householdId: householdId as string,
        filters,
        sort,
        page,
        pageSize,
      }),
    enabled: Boolean(householdId),
    // Keeps the previous page visible while the next one loads (no layout jump).
    placeholderData: keepPreviousData,
  });
}

export function useExpensesInRange(params: {
  householdId: string | null;
  from: string;
  to: string;
  memberId?: string;
  limit?: number;
  enabled?: boolean;
}) {
  const { householdId, from, to, memberId, limit, enabled = true } = params;
  return useQuery({
    queryKey: [
      ...queryKeys.expenses(householdId ?? 'none'),
      'range',
      from,
      to,
      memberId ?? 'all',
      limit ?? 1000,
    ],
    queryFn: () =>
      listExpensesInRange({
        householdId: householdId as string,
        from,
        to,
        memberId,
        limit,
      }),
    enabled: Boolean(householdId) && enabled,
  });
}

export function useTopExpenses(params: {
  householdId: string | null;
  from: string;
  to: string;
  limit?: number;
}) {
  const { householdId, from, to, limit = 5 } = params;
  return useQuery({
    queryKey: [...queryKeys.expenses(householdId ?? 'none'), 'top', from, to, limit],
    queryFn: () =>
      listTopExpenses({ householdId: householdId as string, from, to, limit }),
    enabled: Boolean(householdId),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExpenseWriteInput) => createExpense(input),
    onSuccess: (_result, variables) => invalidateLedgerData(queryClient, variables.householdId),
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      expenseId: string;
      householdId: string;
      values: Omit<ExpenseWriteInput, 'householdId'>;
    }) => updateExpense(input.expenseId, input.values),
    onSuccess: (_result, variables) => invalidateLedgerData(queryClient, variables.householdId),
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { expenseId: string; householdId: string }) =>
      deleteExpense(input.expenseId),
    onSuccess: (_result, variables) => invalidateLedgerData(queryClient, variables.householdId),
  });
}

/** Range totals for the ledger header (cheap: one aggregate in PostgreSQL). */
export function usePeriodTotals(params: {
  householdId: string | null;
  from: string;
  to: string;
}) {
  const { householdId, from, to } = params;
  return useQuery({
    queryKey: queryKeys.periodTotals(householdId ?? 'none', from, to),
    queryFn: () => getPeriodTotals(householdId as string, from, to),
    enabled: Boolean(householdId),
  });
}

/** Fetches a whole window (up to `limit` rows) for CSV export. */
export function useExportExpenses() {
  return useMutation({
    mutationFn: (input: { householdId: string; from: string; to: string; limit?: number }) =>
      listExpensesInRange({
        householdId: input.householdId,
        from: input.from,
        to: input.to,
        limit: input.limit ?? 5000,
      }),
  });
}
