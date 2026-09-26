import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import {
  createCategory,
  deleteCategory,
  listCategories,
  setCategoryArchived,
  updateCategory,
} from '@/services/categories.service';

/** Category queries and mutations (writes are owner-only, enforced by RLS). */
export function useCategories(householdId: string | null) {
  return useQuery({
    queryKey: queryKeys.categories(householdId ?? 'none'),
    queryFn: () => listCategories(householdId as string),
    enabled: Boolean(householdId),
    staleTime: 5 * 60_000,
  });
}

/**
 * Category names/icons are embedded in expense rows, so a category change also
 * invalidates the ledger to keep every list consistent.
 */
function invalidateCategories(
  queryClient: ReturnType<typeof useQueryClient>,
  householdId: string,
): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.categories(householdId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.expenses(householdId) });
  void queryClient.invalidateQueries({ queryKey: ['monthly-insights', householdId] });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      householdId: string;
      name: string;
      icon: string;
      color: string;
      createdBy: string;
    }) => createCategory(input),
    onSuccess: (_data, variables) => invalidateCategories(queryClient, variables.householdId),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      householdId: string;
      categoryId: string;
      changes: { name?: string; icon?: string; color?: string; is_active?: boolean };
    }) => updateCategory(input.categoryId, input.changes),
    onSuccess: (_data, variables) => invalidateCategories(queryClient, variables.householdId),
  });
}

export function useArchiveCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { householdId: string; categoryId: string; archived: boolean }) =>
      setCategoryArchived(input.categoryId, input.archived),
    onSuccess: (_data, variables) => invalidateCategories(queryClient, variables.householdId),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { householdId: string; categoryId: string }) =>
      deleteCategory(input.categoryId),
    onSuccess: (_data, variables) => invalidateCategories(queryClient, variables.householdId),
  });
}
