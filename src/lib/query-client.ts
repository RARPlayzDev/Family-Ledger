import { QueryClient } from '@tanstack/react-query';
import { normalizeError } from '@/lib/errors';

/**
 * Central query defaults.
 * - The ledger is shared between family members, so a short stale time keeps the
 *   UI responsive to changes other members made without hammering the API.
 * - Authentication failures are never retried; they need a re-login.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          if (normalizeError(error).isAuthError) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export const queryKeys = {
  session: ['session'] as const,
  profile: (userId: string) => ['profile', userId] as const,
  memberships: (userId: string) => ['memberships', userId] as const,
  householdMembers: (householdId: string) => ['household-members', householdId] as const,
  categories: (householdId: string) => ['categories', householdId] as const,
  expenses: (householdId: string) => ['expenses', householdId] as const,
  expenseList: (householdId: string, filters: unknown, sort: unknown, page: number) =>
    ['expenses', householdId, 'list', filters, sort, page] as const,
  recentExpenses: (householdId: string) => ['expenses', householdId, 'recent'] as const,
  periodTotals: (householdId: string, from: string, to: string) =>
    ['expenses', householdId, 'period-totals', from, to] as const,
  categoryTotals: (householdId: string, from: string, to: string) =>
    ['expenses', householdId, 'category-totals', from, to] as const,
  memberTotals: (householdId: string, from: string, to: string) =>
    ['expenses', householdId, 'member-totals', from, to] as const,
  dailyTotals: (householdId: string, from: string, to: string) =>
    ['expenses', householdId, 'daily-totals', from, to] as const,
  memberInsights: (householdId: string, userId: string, monthKey: string) =>
    ['member-insights', householdId, userId, monthKey] as const,
  monthlyInsights: (householdId: string, monthKey: string) =>
    ['monthly-insights', householdId, monthKey] as const,
  budgets: (householdId: string, periodMonth: string) =>
    ['budgets', householdId, periodMonth] as const,
};
