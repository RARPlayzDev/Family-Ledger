import { describe, expect, it } from 'vitest';
import {
  averageDailySpend,
  biggestIncreases,
  buildCumulativeSeries,
  buildDailySeries,
  categoryTotalsFromExpenses,
  compareCategoryTotals,
  comparePeriods,
  dailyTotalsFromExpenses,
  hasAnySpending,
  largestExpenses,
  latestExpenses,
  rankCategories,
  withCategoryShares,
  withMemberShares,
} from '@/domain/analytics';
import type { DateRange } from '@/domain/dates';
import type {
  CategoryTotal,
  ExpenseWithRelations,
  MemberTotal,
  PeriodTotals,
} from '@/types/domain';

const RANGE: DateRange = { from: '2026-09-01', to: '2026-09-05' };

function makeCategoryTotal(overrides: Partial<CategoryTotal> = {}): CategoryTotal {
  return {
    category_id: 'cat-1',
    category_name: 'Groceries',
    category_icon: 'ShoppingCart',
    category_color: '#111111',
    total_paise: 0,
    expense_count: 1,
    ...overrides,
  };
}

function makeMemberTotal(overrides: Partial<MemberTotal> = {}): MemberTotal {
  return {
    user_id: 'u1',
    display_name: 'Asha',
    avatar_url: null,
    role: 'owner',
    total_paise: 0,
    expense_count: 1,
    ...overrides,
  };
}

function makePeriodTotals(overrides: Partial<PeriodTotals> = {}): PeriodTotals {
  return {
    total_paise: 0,
    expense_count: 0,
    member_count: 0,
    largest_expense_paise: 0,
    average_expense_paise: 0,
    ...overrides,
  };
}

function makeExpense(overrides: Partial<ExpenseWithRelations> = {}): ExpenseWithRelations {
  return {
    id: 'e1',
    household_id: 'h1',
    spent_by: 'u1',
    category_id: 'cat-1',
    amount_paise: 10_000,
    expense_date: '2026-09-01',
    merchant: null,
    note: null,
    payment_method: 'upi',
    created_at: '2026-09-01T10:00:00+00:00',
    updated_at: '2026-09-01T10:00:00+00:00',
    category: { id: 'cat-1', name: 'Groceries', icon: 'ShoppingCart', color: '#111111' },
    spender: { id: 'u1', display_name: 'Asha', avatar_url: null },
    ...overrides,
  };
}

describe('buildDailySeries', () => {
  it('zero-fills days that have no spending', () => {
    const series = buildDailySeries(RANGE, [
      { day: '2026-09-02', total_paise: 50_000, expense_count: 2 },
      { day: '2026-09-04', total_paise: 10_000, expense_count: 1 },
    ]);

    expect(series).toHaveLength(5);
    expect(series[0]).toEqual({ day: '2026-09-01', total_paise: 0, expense_count: 0 });
    expect(series[1]).toEqual({ day: '2026-09-02', total_paise: 50_000, expense_count: 2 });
    expect(series[2]).toEqual({ day: '2026-09-03', total_paise: 0, expense_count: 0 });
    expect(series[3]).toEqual({ day: '2026-09-04', total_paise: 10_000, expense_count: 1 });
    expect(series[4]).toEqual({ day: '2026-09-05', total_paise: 0, expense_count: 0 });
  });

  it('ignores totals outside the range and returns empty for reversed ranges', () => {
    const series = buildDailySeries(RANGE, [
      { day: '2026-08-31', total_paise: 99_999, expense_count: 9 },
    ]);
    expect(series).toHaveLength(5);
    expect(series.every((point) => point.total_paise === 0)).toBe(true);

    expect(buildDailySeries({ from: '2026-09-05', to: '2026-09-01' }, [])).toEqual([]);
  });
});

describe('buildCumulativeSeries', () => {
  it('accumulates a running total and labels each day', () => {
    const points = buildCumulativeSeries([
      { day: '2026-09-01', total_paise: 10_000, expense_count: 1 },
      { day: '2026-09-02', total_paise: 25_000, expense_count: 3 },
      { day: '2026-09-03', total_paise: 0, expense_count: 0 },
    ]);

    expect(points.map((point) => point.cumulative_paise)).toEqual([10_000, 35_000, 35_000]);
    expect(points.map((point) => point.total_paise)).toEqual([10_000, 25_000, 0]);
    expect(points[0].label).toBe('1 Sep');
    expect(points[0].expense_count).toBe(1);
  });

  it('returns an empty series for no data', () => {
    expect(buildCumulativeSeries([])).toEqual([]);
  });
});

describe('rankCategories', () => {
  it('sorts by spend descending and breaks ties alphabetically', () => {
    const ranked = rankCategories([
      makeCategoryTotal({ category_id: 'b', category_name: 'Transport', total_paise: 50_000 }),
      makeCategoryTotal({ category_id: 'a', category_name: 'Food', total_paise: 50_000 }),
      makeCategoryTotal({ category_id: 'c', category_name: 'Rent', total_paise: 90_000 }),
    ]);

    expect(ranked.map((row) => row.category_name)).toEqual(['Rent', 'Food', 'Transport']);
  });

  it('does not mutate the input array', () => {
    const totals = [
      makeCategoryTotal({ category_name: 'B', total_paise: 1 }),
      makeCategoryTotal({ category_name: 'A', total_paise: 2 }),
    ];
    rankCategories(totals);
    expect(totals[0].category_name).toBe('B');
  });
});

describe('withCategoryShares', () => {
  it('ranks and computes each share of the grand total', () => {
    const rows = withCategoryShares([
      makeCategoryTotal({ category_name: 'Food', total_paise: 75_000 }),
      makeCategoryTotal({ category_name: 'Rent', total_paise: 25_000 }),
    ]);

    expect(rows.map((row) => row.category_name)).toEqual(['Food', 'Rent']);
    expect(rows.map((row) => row.share_percent)).toEqual([75, 25]);
  });

  it('returns null shares when the grand total is zero', () => {
    const rows = withCategoryShares([makeCategoryTotal({ total_paise: 0 })]);
    expect(rows[0].share_percent).toBeNull();
  });
});

describe('withMemberShares', () => {
  it('sorts members by spend and computes shares', () => {
    const rows = withMemberShares([
      makeMemberTotal({ user_id: 'u1', display_name: 'Asha', total_paise: 30_000 }),
      makeMemberTotal({ user_id: 'u2', display_name: 'Ravi', total_paise: 70_000, role: 'member' }),
    ]);

    expect(rows.map((row) => row.display_name)).toEqual(['Ravi', 'Asha']);
    expect(rows.map((row) => row.share_percent)).toEqual([70, 30]);
  });

  it('returns null shares when nobody spent', () => {
    const rows = withMemberShares([makeMemberTotal({ total_paise: 0 })]);
    expect(rows[0].share_percent).toBeNull();
  });
});

describe('largestExpenses', () => {
  it('returns the top expenses by amount, defaulting to five', () => {
    const expenses = Array.from({ length: 7 }, (_, index) =>
      makeExpense({ id: `e${index}`, amount_paise: (index + 1) * 1_000 }),
    );

    const top = largestExpenses(expenses);
    expect(top).toHaveLength(5);
    expect(top[0].amount_paise).toBe(7_000);
    expect(top[4].amount_paise).toBe(3_000);
  });

  it('breaks amount ties by the earlier expense date', () => {
    const top = largestExpenses(
      [
        makeExpense({ id: 'later', amount_paise: 5_000, expense_date: '2026-09-03' }),
        makeExpense({ id: 'earlier', amount_paise: 5_000, expense_date: '2026-09-01' }),
      ],
      1,
    );

    expect(top.map((expense) => expense.id)).toEqual(['earlier']);
  });

  it('honours an explicit limit, including zero', () => {
    const expenses = [makeExpense({ amount_paise: 1_000 }), makeExpense({ amount_paise: 2_000 })];
    expect(largestExpenses(expenses, 1)).toHaveLength(1);
    expect(largestExpenses(expenses, 0)).toEqual([]);
    expect(largestExpenses(expenses, 99)).toHaveLength(2);
  });
});

describe('latestExpenses', () => {
  it('sorts by expense date desc, then by creation time desc', () => {
    const latest = latestExpenses([
      makeExpense({ id: 'old', expense_date: '2026-09-01', created_at: '2026-09-01T09:00:00+00:00' }),
      makeExpense({
        id: 'newer-tie',
        expense_date: '2026-09-02',
        created_at: '2026-09-02T12:00:00+00:00',
      }),
      makeExpense({
        id: 'newer-early',
        expense_date: '2026-09-02',
        created_at: '2026-09-02T08:00:00+00:00',
      }),
    ]);

    expect(latest.map((expense) => expense.id)).toEqual(['newer-tie', 'newer-early', 'old']);
  });

  it('defaults to eight entries', () => {
    const expenses = Array.from({ length: 10 }, (_, index) =>
      makeExpense({
        id: `e${index}`,
        expense_date: `2026-09-${String(index + 1).padStart(2, '0')}`,
      }),
    );
    expect(latestExpenses(expenses)).toHaveLength(8);
    expect(latestExpenses(expenses)[0].expense_date).toBe('2026-09-10');
  });
});

describe('averageDailySpend', () => {
  it('rounds the per-day average to whole paise', () => {
    expect(averageDailySpend(100_000, 3)).toBe(33_333);
    expect(averageDailySpend(100_100, 2)).toBe(50_050);
  });

  it('returns zero when no days were counted', () => {
    expect(averageDailySpend(100_000, 0)).toBe(0);
    expect(averageDailySpend(100_000, -5)).toBe(0);
  });
});

describe('hasAnySpending', () => {
  it('detects quiet periods, including missing totals', () => {
    expect(hasAnySpending(makePeriodTotals({ total_paise: 1 }))).toBe(true);
    expect(hasAnySpending(makePeriodTotals({ total_paise: 0 }))).toBe(false);
    expect(hasAnySpending(null)).toBe(false);
    expect(hasAnySpending(undefined)).toBe(false);
  });
});

describe('comparePeriods', () => {
  it('computes the delta and a defined percentage change', () => {
    const comparison = comparePeriods(
      makePeriodTotals({ total_paise: 150_000, expense_count: 6 }),
      makePeriodTotals({ total_paise: 100_000, expense_count: 4 }),
    );

    expect(comparison.delta_paise).toBe(50_000);
    expect(comparison.change).toEqual({ percent: 50, direction: 'up', defined: true });
    expect(comparison.hasPrevious).toBe(true);
    expect(comparison.current.expense_count).toBe(6);
  });

  it('reports an undefined change when the previous period had no spending', () => {
    const comparison = comparePeriods(makePeriodTotals({ total_paise: 50_000 }), makePeriodTotals());

    expect(comparison.change.defined).toBe(false);
    expect(comparison.change.reason).toBe('no_previous_data');
    expect(comparison.hasPrevious).toBe(false);
    expect(comparison.delta_paise).toBe(50_000);
  });

  it('reports a flat change when both periods are equal', () => {
    const comparison = comparePeriods(
      makePeriodTotals({ total_paise: 70_000 }),
      makePeriodTotals({ total_paise: 70_000 }),
    );
    expect(comparison.change).toEqual({ percent: 0, direction: 'flat', defined: true });
    expect(comparison.delta_paise).toBe(0);
  });
});

describe('compareCategoryTotals', () => {
  it('unions both months and sorts by absolute movement', () => {
    const movements = compareCategoryTotals(
      [
        makeCategoryTotal({ category_id: 'cat-1', category_name: 'Food', total_paise: 90_000, expense_count: 5 }),
        makeCategoryTotal({ category_id: 'cat-2', category_name: 'Transport', total_paise: 10_000, expense_count: 1 }),
      ],
      [makeCategoryTotal({ category_id: 'cat-1', category_name: 'Food', total_paise: 40_000 })],
    );

    expect(movements.map((row) => row.category_name)).toEqual(['Food', 'Transport']);
    expect(movements[0]).toMatchObject({
      previous_paise: 40_000,
      delta_paise: 50_000,
      expense_count: 5,
      change: { percent: 125, direction: 'up', defined: true },
    });
    expect(movements[1]).toMatchObject({
      previous_paise: 0,
      delta_paise: 10_000,
      change: { percent: null, direction: 'up', defined: false, reason: 'no_previous_data' },
    });
  });

  it('treats null category ids as one uncategorised bucket', () => {
    const movements = compareCategoryTotals(
      [makeCategoryTotal({ category_id: null, total_paise: 20_000 })],
      [makeCategoryTotal({ category_id: null, total_paise: 5_000 })],
    );

    expect(movements).toHaveLength(1);
    expect(movements[0].category_id).toBeNull();
    expect(movements[0].delta_paise).toBe(15_000);
  });

  it('keeps categories that only existed last month with a fallback label', () => {
    const movements = compareCategoryTotals(
      [],
      [makeCategoryTotal({ category_id: 'cat-gone', category_name: 'Gifts', total_paise: 30_000 })],
    );

    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      category_id: 'cat-gone',
      category_name: 'Unknown',
      total_paise: 0,
      previous_paise: 30_000,
      delta_paise: -30_000,
      change: { percent: -100, direction: 'down', defined: true },
    });
  });

  it('labels a vanished uncategorised bucket as Uncategorised', () => {
    const movements = compareCategoryTotals(
      [],
      [makeCategoryTotal({ category_id: null, total_paise: 1_000 })],
    );
    expect(movements[0].category_name).toBe('Uncategorised');
  });
});

describe('biggestIncreases', () => {
  it('keeps only increases, in order, up to the limit', () => {
    const movements = compareCategoryTotals(
      [
        makeCategoryTotal({ category_id: 'a', category_name: 'A', total_paise: 50_000 }),
        makeCategoryTotal({ category_id: 'b', category_name: 'B', total_paise: 40_000 }),
        makeCategoryTotal({ category_id: 'c', category_name: 'C', total_paise: 20_000 }),
      ],
      [
        makeCategoryTotal({ category_id: 'a', category_name: 'A', total_paise: 10_000 }),
        makeCategoryTotal({ category_id: 'b', category_name: 'B', total_paise: 20_000 }),
        makeCategoryTotal({ category_id: 'c', category_name: 'C', total_paise: 30_000 }),
      ],
    );

    const increases = biggestIncreases(movements, 2);
    expect(increases.map((row) => row.category_name)).toEqual(['A', 'B']);
    expect(biggestIncreases(movements, 0)).toEqual([]);
  });
});

describe('categoryTotalsFromExpenses', () => {
  it('aggregates by category and ranks the result', () => {
    const totals = categoryTotalsFromExpenses([
      makeExpense({ id: 'e1', category_id: 'cat-1', amount_paise: 10_000 }),
      makeExpense({
        id: 'e2',
        category_id: 'cat-2',
        amount_paise: 50_000,
        category: { id: 'cat-2', name: 'Rent', icon: 'Home', color: '#222222' },
      }),
      makeExpense({ id: 'e3', category_id: 'cat-1', amount_paise: 15_000 }),
    ]);

    expect(totals).toHaveLength(2);
    expect(totals[0]).toMatchObject({ category_name: 'Rent', total_paise: 50_000, expense_count: 1 });
    expect(totals[1]).toMatchObject({ category_name: 'Groceries', total_paise: 25_000, expense_count: 2 });
  });

  it('groups expenses without a category under Uncategorised', () => {
    const totals = categoryTotalsFromExpenses([
      makeExpense({ id: 'e1', category_id: null, amount_paise: 5_000, category: null }),
      makeExpense({ id: 'e2', category_id: null, amount_paise: 7_000, category: null }),
    ]);

    expect(totals).toHaveLength(1);
    expect(totals[0]).toMatchObject({
      category_id: null,
      category_name: 'Uncategorised',
      category_icon: 'Tag',
      category_color: '#6C737D',
      total_paise: 12_000,
      expense_count: 2,
    });
  });

  it('returns an empty list when there are no expenses', () => {
    expect(categoryTotalsFromExpenses([])).toEqual([]);
  });
});

describe('dailyTotalsFromExpenses', () => {
  it('aggregates per day and zero-fills the range', () => {
    const series = dailyTotalsFromExpenses(
      [
        makeExpense({ id: 'e1', expense_date: '2026-09-01', amount_paise: 2_000 }),
        makeExpense({ id: 'e2', expense_date: '2026-09-01', amount_paise: 3_000 }),
        makeExpense({ id: 'e3', expense_date: '2026-09-03', amount_paise: 9_000 }),
        makeExpense({ id: 'e4', expense_date: '2026-08-31', amount_paise: 99_999 }),
      ],
      RANGE,
    );

    expect(series).toHaveLength(5);
    expect(series[0]).toEqual({ day: '2026-09-01', total_paise: 5_000, expense_count: 2 });
    expect(series[1]).toEqual({ day: '2026-09-02', total_paise: 0, expense_count: 0 });
    expect(series[2]).toEqual({ day: '2026-09-03', total_paise: 9_000, expense_count: 1 });
  });
});




