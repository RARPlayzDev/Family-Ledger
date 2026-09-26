import { describe, expect, it } from 'vitest';
import {
  daysElapsedInMonth,
  daysInMonth,
  formatMonthLabel,
  isMonthKey,
  monthRange,
  previousMonthKey,
  shiftMonthKey,
} from '@/domain/dates';

describe('dates domain logic', () => {
  it('validates ISO month keys', () => {
    expect(isMonthKey('2026-09')).toBe(true);
    expect(isMonthKey('2026-12')).toBe(true);
    expect(isMonthKey('2026-13')).toBe(false);
    expect(isMonthKey('2026-00')).toBe(false);
    expect(isMonthKey('invalid')).toBe(false);
  });

  it('navigates previous and next months correctly across year boundaries', () => {
    expect(previousMonthKey('2026-09')).toBe('2026-08');
    expect(previousMonthKey('2026-01')).toBe('2025-12');
    expect(shiftMonthKey('2026-09', 1)).toBe('2026-10');
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
  });

  it('determines days in month accurately (including leap years)', () => {
    expect(daysInMonth('2026-09')).toBe(30);
    expect(daysInMonth('2026-08')).toBe(31);
    expect(daysInMonth('2024-02')).toBe(29); // 2024 is a leap year
    expect(daysInMonth('2026-02')).toBe(28); // 2026 is non-leap
  });

  it('generates exact ISO ranges for months', () => {
    const range = monthRange('2026-09');
    expect(range.from).toBe('2026-09-01');
    expect(range.to).toBe('2026-09-30');
  });

  it('calculates elapsed days in current month accurately', () => {
    expect(daysElapsedInMonth('2026-09', '2026-09-15')).toBe(15);
    expect(daysElapsedInMonth('2026-09', '2026-09-01')).toBe(1);
    expect(daysElapsedInMonth('2026-09', '2026-10-15')).toBe(30);
  });

  it('formats month labels in Indian English', () => {
    expect(formatMonthLabel('2026-09')).toBe('September 2026');
    expect(formatMonthLabel('2026-01')).toBe('January 2026');
  });
});

