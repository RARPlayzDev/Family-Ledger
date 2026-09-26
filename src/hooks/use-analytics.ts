import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import { monthRange, previousMonthKey } from '@/domain/dates';
import {
  categoryTotalsFromExpenses,
  dailyTotalsFromExpenses,
} from '@/domain/analytics';
import { summarizeExpenses } from '@/domain/expenses';
import {
  getCategoryTotals,
  getDailyTotals,
  getMemberTotals,
  getPeriodTotals,
  listExpensesInRange,
  listTopExpenses,
} from '@/services/expenses.service';
import type { MemberInsights, MemberSummary, MonthlyInsights } from '@/types/domain';

/**
 * Monthly dashboard/analytics bundle.
 *
 * One React Query entry fetches all five aggregates in parallel; the household
 * RPCs run with the caller's privileges so a member of another household simply
 * gets empty results.
 */
export function useMonthlyInsights(householdId: string | null, monthKey: string) {
  const range = monthRange(monthKey);
  const previousRange = monthRange(previousMonthKey(monthKey));

  return useQuery({
    queryKey: queryKeys.monthlyInsights(householdId ?? 'none', monthKey),
    enabled: Boolean(householdId),
    queryFn: async (): Promise<MonthlyInsights> => {
      const id = householdId as string;
      const [
        totals,
        previousTotals,
        categoryTotals,
        memberTotals,
        dailyTotals,
        recentExpenses,
        topExpenses,
      ] = await Promise.all([
        getPeriodTotals(id, range.from, range.to),
        getPeriodTotals(id, previousRange.from, previousRange.to),
        getCategoryTotals(id, range.from, range.to),
        getMemberTotals(id, range.from, range.to),
        getDailyTotals(id, range.from, range.to),
        listExpensesInRange({ householdId: id, from: range.from, to: range.to, limit: 8 }),
        listTopExpenses({ householdId: id, from: range.from, to: range.to, limit: 5 }),
      ]);

      return {
        householdId: id,
        monthKey,
        range,
        totals,
        previousTotals,
        categoryTotals,
        memberTotals,
        dailyTotals,
        recentExpenses,
        topExpenses,
      };
    },
  });
}

/** Category totals for any ad-hoc period (used by the month-over-month view). */
export function useCategoryTotals(params: {
  householdId: string | null;
  from: string;
  to: string;
}) {
  const { householdId, from, to } = params;
  return useQuery({
    queryKey: queryKeys.categoryTotals(householdId ?? 'none', from, to),
    queryFn: () => getCategoryTotals(householdId as string, from, to),
    enabled: Boolean(householdId),
  });
}

/**
 * Per-member view of the same shared ledger.
 *
 * The household RPCs aggregate the whole ledger, so a member's own breakdown is
 * derived from their rows with the tested domain helpers instead.
 */
export function useMemberInsights(params: {
  householdId: string | null;
  member: MemberSummary | null;
  monthKey: string;
}) {
  const { householdId, member, monthKey } = params;
  const range = monthRange(monthKey);
  const memberId = member?.id ?? null;

  return useQuery({
    queryKey: queryKeys.memberInsights(householdId ?? 'none', memberId ?? 'none', monthKey),
    enabled: Boolean(householdId) && Boolean(memberId),
    queryFn: async (): Promise<MemberInsights> => {
      const expenses = await listExpensesInRange({
        householdId: householdId as string,
        from: range.from,
        to: range.to,
        memberId: memberId as string,
        limit: 1000,
      });

      return {
        member,
        totals: summarizeExpenses(expenses),
        categoryTotals: categoryTotalsFromExpenses(expenses),
        dailyTotals: dailyTotalsFromExpenses(expenses, range),
        expenses,
      };
    },
  });
}
