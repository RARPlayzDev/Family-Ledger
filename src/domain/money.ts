/**
 * Money handling for FamilyLedger.
 *
 * Every monetary value is an INTEGER number of paise (BIGINT in PostgreSQL).
 * Rupee <-> paise conversion happens at a single controlled boundary
 * (`parseRupeeInput`, `rupeesToPaise`) and all arithmetic stays integral, so
 * totals can never drift through floating point rounding.
 */

export const PAISE_PER_RUPEE = 100;

/** Mirrors the `amount_paise` check constraint in the migrations. */
export const MAX_PAISE = 1_000_000_000_000; // ₹10,00,00,00,000

export type INRDecimals = 'auto' | 0 | 2;

export type INRFormatOptions = {
  /** 'auto' shows decimals only when there are paise. */
  decimals?: INRDecimals;
  /** Compact notation such as ₹1.2L for chart axes. */
  compact?: boolean;
  /** Prefix a '+' for positive values. */
  showSign?: boolean;
};

export function isIntegerPaise(value: number): boolean {
  return Number.isInteger(value);
}

/** Rupees -> paise for programmatic values. Prefer `parseRupeeInput` for forms. */
export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) {
    throw new RangeError('Amount must be a finite number.');
  }
  return Math.round(rupees * PAISE_PER_RUPEE);
}

export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

/**
 * Parses user input ("1,250.50", "₹250", " 75 ") into integer paise.
 * Returns null when the value is not a usable positive amount, which lets Zod
 * report a precise validation error instead of throwing.
 */
export function parseRupeeInput(input: string): number | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.replace(/[,\s\u20B9\u00A0]/g, '');
  if (cleaned.length === 0) return null;
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(cleaned)) return null;

  const [wholePart, fractionPart = ''] = cleaned.split('.');
  const whole = Number(wholePart);
  const fraction = Number((fractionPart + '00').slice(0, 2));
  const paise = whole * PAISE_PER_RUPEE + fraction;

  if (!Number.isSafeInteger(paise) || paise <= 0 || paise > MAX_PAISE) return null;
  return paise;
}

/** Formats integer paise using Indian digit grouping and the rupee symbol. */
export function formatINR(paise: number, options: INRFormatOptions = {}): string {
  const { decimals = 'auto', compact = false, showSign = false } = options;
  if (!Number.isFinite(paise)) return '—';

  const rupees = paise / PAISE_PER_RUPEE;
  const fractionDigits =
    decimals === 'auto' ? (Number.isInteger(rupees) ? 0 : 2) : decimals;

  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    notation: compact ? 'compact' : 'standard',
    compactDisplay: 'short',
  }).format(Math.abs(rupees));

  if (paise < 0) return `-${formatted}`;
  return showSign && paise > 0 ? `+${formatted}` : formatted;
}

/** Formats a plain rupee value (already converted) for labels and hints. */
export function formatRupees(rupees: number, options: INRFormatOptions = {}): string {
  return formatINR(rupeesToPaise(rupees), options);
}

/** Integer-safe sum. Throws on non-integer input so bugs surface in tests. */
export function sumPaise(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    if (!isIntegerPaise(value)) {
      throw new TypeError(`sumPaise received a non-integer paise value: ${value}`);
    }
    total += value;
  }
  return total;
}

/** Integer-safe average (rounded to the nearest paise). */
export function averagePaise(totalPaise: number, count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.round(totalPaise / count);
}

export type PercentChange = {
  /** null when a percentage is mathematically undefined (previous = 0). */
  percent: number | null;
  direction: 'up' | 'down' | 'flat';
  defined: boolean;
  reason?: 'no_previous_data';
};

export function percentChange(current: number, previous: number): PercentChange {
  if (previous === 0) {
    if (current === 0) return { percent: 0, direction: 'flat', defined: true };
    // Dividing by zero is meaningless: report the direction without a percentage.
    return { percent: null, direction: 'up', defined: false, reason: 'no_previous_data' };
  }
  const rounded = Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
  if (rounded === 0) return { percent: 0, direction: 'flat', defined: true };
  return { percent: rounded, direction: rounded > 0 ? 'up' : 'down', defined: true };
}

/** Share of a total as a percentage, or null when the total is zero. */
export function shareOfTotal(part: number, total: number): number | null {
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.round((part / total) * 1000) / 10;
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

/** Human wording for a percentage change, including the undefined-total case. */
export function describePercentChange(change: PercentChange): string {
  if (!change.defined) {
    return 'No spending recorded last month';
  }
  if (change.direction === 'flat') return 'No change vs last month';
  return `${Math.abs(change.percent ?? 0).toFixed(1)}% ${
    change.direction === 'up' ? 'more' : 'less'
  } than last month`;
}
