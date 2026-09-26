import { describe, expect, it } from 'vitest';
import {
  formatINR,
  formatPercent,
  isIntegerPaise,
  paiseToRupees,
  parseRupeeInput,
  rupeesToPaise,
} from '@/domain/money';

describe('money domain logic', () => {
  it('identifies integer paise correctly', () => {
    expect(isIntegerPaise(100)).toBe(true);
    expect(isIntegerPaise(0)).toBe(true);
    expect(isIntegerPaise(-50)).toBe(true);
    expect(isIntegerPaise(100.5)).toBe(false);
  });

  it('converts rupees to paise accurately', () => {
    expect(rupeesToPaise(100)).toBe(10000);
    expect(rupeesToPaise(12.5)).toBe(1250);
    expect(rupeesToPaise(0.99)).toBe(99);
  });

  it('converts paise to rupees accurately', () => {
    expect(paiseToRupees(10000)).toBe(100);
    expect(paiseToRupees(1250)).toBe(12.5);
    expect(paiseToRupees(99)).toBe(0.99);
  });

  it('parses user rupee input safely', () => {
    expect(parseRupeeInput('1250')).toBe(125000);
    expect(parseRupeeInput('1,250.50')).toBe(125050);
    expect(parseRupeeInput('₹250')).toBe(25000);
    expect(parseRupeeInput('  500  ')).toBe(50000);
    expect(parseRupeeInput('')).toBeNull();
    expect(parseRupeeInput('abc')).toBeNull();
    expect(parseRupeeInput('-50')).toBeNull();
  });

  it('formats INR amounts according to Indian numbering system', () => {
    expect(formatINR(100000)).toBe('₹1,000');
    expect(formatINR(10000000)).toBe('₹1,00,000');
    expect(formatINR(100050)).toBe('₹1,000.50');
  });

  it('formats percentages accurately', () => {
    expect(formatPercent(45.67)).toBe('45.7%');
    expect(formatPercent(100)).toBe('100.0%');
    expect(formatPercent(null)).toBe('—');
  });
});
