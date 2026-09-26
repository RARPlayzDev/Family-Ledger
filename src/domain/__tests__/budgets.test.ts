import { describe, expect, it } from 'vitest';
import {
  budgetPace,
  budgetStateLabel,
  budgetStateTone,
  evaluateBudget,
  totalCategoryAllocation,
  unplannedSpend,
} from '@/domain/budgets';
import type { CategoryBudgetRow } from '@/types/domain';

describe('budgets domain logic', () => {
  it('evaluates budget limits correctly when unset', () => {
    const verdict = evaluateBudget(null, 5000);
    expect(verdict.state).toBe('unset');
    expect(verdict.allocated_paise).toBeNull();
    expect(verdict.remaining_paise).toBeNull();
    expect(verdict.spent_paise).toBe(5000);
  });

  it('evaluates budget limits on track', () => {
    const verdict = evaluateBudget(100000, 50000); // 50%
    expect(verdict.state).toBe('on_track');
    expect(verdict.remaining_paise).toBe(50000);
    expect(verdict.utilization_percent).toBe(50);
    expect(verdict.overspend_paise).toBe(0);
    expect(budgetStateTone(verdict.state)).toBe('accent');
    expect(budgetStateLabel(verdict.state)).toBe('On track');
  });

  it('evaluates budget limits at warning threshold (>= 80%)', () => {
    const verdict = evaluateBudget(100000, 85000); // 85%
    expect(verdict.state).toBe('warning');
    expect(verdict.remaining_paise).toBe(15000);
    expect(verdict.utilization_percent).toBe(85);
    expect(budgetStateTone(verdict.state)).toBe('warn');
    expect(budgetStateLabel(verdict.state)).toBe('Approaching limit');
  });

  it('evaluates exceeded budget limits', () => {
    const verdict = evaluateBudget(100000, 120000); // 120%
    expect(verdict.state).toBe('exceeded');
    expect(verdict.remaining_paise).toBe(-20000);
    expect(verdict.overspend_paise).toBe(20000);
    expect(budgetStateTone(verdict.state)).toBe('danger');
    expect(budgetStateLabel(verdict.state)).toBe('Over budget');
  });

  it('calculates budget pace correctly', () => {
    // 50k spent by day 10 of 30 days -> projected 150k -> ahead (over 100k budget)
    expect(budgetPace(100000, 50000, 10, 30)).toBe('ahead');

    // 20k spent by day 10 of 30 days -> projected 60k -> behind (under 100k budget)
    expect(budgetPace(100000, 20000, 10, 30)).toBe('behind');

    // 33.3k spent by day 10 of 30 days -> projected 100k -> on pace
    expect(budgetPace(100000, 33333, 10, 30)).toBe('on_pace');
  });

  it('calculates total category allocation independently of household limit', () => {
    const rows: CategoryBudgetRow[] = [
      {
        id: '1',
        household_id: 'h1',
        category_id: 'cat1',
        amount_paise: 50000,
        period_month: '2026-09',
        created_by: 'u1',
        created_at: '',
        updated_at: '',
        category: null,
        spent_paise: 20000,
      },
      {
        id: '2',
        household_id: 'h1',
        category_id: 'cat2',
        amount_paise: 30000,
        period_month: '2026-09',
        created_by: 'u1',
        created_at: '',
        updated_at: '',
        category: null,
        spent_paise: 15000,
      },
    ];

    expect(totalCategoryAllocation(rows)).toBe(80000);
    expect(unplannedSpend(rows, 40000)).toBe(5000); // 40k total - 35k planned
  });
});
