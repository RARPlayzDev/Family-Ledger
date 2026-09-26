import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import {
  clearBudgetForCategory,
  copyBudgetsFromMonth,
  deleteBudget,
  listBudgets,
  saveBudget,
  type BudgetInput,
} from '@/services/budgets.service';

/** Budget queries and mutations for one month. */
export function useBudgets(householdId: string | null, periodMonth: string) {
  return useQuery({
    queryKey: queryKeys.budgets(householdId ?? 'none', periodMonth),
    queryFn: () => listBudgets(householdId as string, periodMonth),
    enabled: Boolean(householdId),
  });
}

function invalidateBudgets(
  queryClient: ReturnType<typeof useQueryClient>,
  householdId: string,
): void {
  void queryClient.invalidateQueries({ queryKey: ['budgets', householdId] });
  void queryClient.invalidateQueries({ queryKey: ['monthly-insights', householdId] });
}

export function useSaveBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BudgetInput) => saveBudget(input),
    onSuccess: (_data, variables) => invalidateBudgets(queryClient, variables.householdId),
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { budgetId: string; householdId: string }) => deleteBudget(input.budgetId),
    onSuccess: (_data, variables) => invalidateBudgets(queryClient, variables.householdId),
  });
}

export function useClearCategoryBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { householdId: string; periodMonth: string; categoryId: string | null }) =>
      clearBudgetForCategory(input.householdId, input.periodMonth, input.categoryId),
    onSuccess: (_data, variables) => invalidateBudgets(queryClient, variables.householdId),
  });
}

export function useCopyBudgets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      householdId: string;
      sourceMonth: string;
      targetMonth: string;
      createdBy: string;
    }) =>
      copyBudgetsFromMonth(
        input.householdId,
        input.sourceMonth,
        input.targetMonth,
        input.createdBy,
      ),
    onSuccess: (_data, variables) => invalidateBudgets(queryClient, variables.householdId),
  });
}
