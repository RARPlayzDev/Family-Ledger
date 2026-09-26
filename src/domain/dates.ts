/**
 * Date helpers for FamilyLedger.
 *
 * Rules enforced here:
 *  - every date that reaches PostgreSQL is an ISO calendar day ('yyyy-MM-dd'),
 *    never a UTC-shifted ISO timestamp, so an expense booked at 11pm IST stays
 *    on the correct day;
 *  - month windows are always computed as [first day, last day] of a month key;
 *  - "today" can be resolved in the household timezone (default Asia/Kolkata)
 *    using Intl, so no timezone library is needed.
 */
import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfMonth,
} from 'date-fns';
import { DEFAULT_TIMEZONE } from '@/lib/env';

export type MonthKey = string; // 'yyyy-MM'
export type IsoDate = string; // 'yyyy-MM-dd'

export type DateRange = { from: IsoDate; to: IsoDate };

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isMonthKey(value: string): boolean {
  return MONTH_KEY_PATTERN.test(value);
}

export function isIsoDate(value: string): boolean {
  return ISO_DATE_PATTERN.test(value) && isValid(parseISO(value));
}

/** Local calendar day as 'yyyy-MM-dd' (no UTC conversion). */
export function toIsoDate(date: Date): IsoDate {
  return format(date, 'yyyy-MM-dd');
}

export function todayIso(): IsoDate {
  return toIsoDate(new Date());
}

/**
 * Today's calendar day inside a specific IANA timezone.
 * Falls back to the device local day for unknown timezones.
 */
export function todayIsoInTimeZone(timeZone = DEFAULT_TIMEZONE): IsoDate {
  try {
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return ISO_DATE_PATTERN.test(formatted) ? formatted : todayIso();
  } catch {
    return todayIso();
  }
}

export function monthKeyOf(value: Date | IsoDate): MonthKey {
  if (typeof value === 'string') return value.slice(0, 7);
  return format(value, 'yyyy-MM');
}

export function currentMonthKey(): MonthKey {
  return monthKeyOf(new Date());
}

export function monthKeyFromIsoDate(isoDate: IsoDate): MonthKey {
  return isoDate.slice(0, 7);
}

export function shiftMonthKey(monthKey: MonthKey, delta: number): MonthKey {
  const base = parseISO(`${monthKey}-01`);
  return format(addMonths(base, delta), 'yyyy-MM');
}

export function previousMonthKey(monthKey: MonthKey): MonthKey {
  return shiftMonthKey(monthKey, -1);
}

/** First and last calendar day of the month, inclusive. */
export function monthRange(monthKey: MonthKey): DateRange {
  const base = parseISO(`${monthKey}-01`);
  return {
    from: format(startOfMonth(base), 'yyyy-MM-dd'),
    to: format(endOfMonth(base), 'yyyy-MM-dd'),
  };
}

export function startOfMonthIso(monthKey: MonthKey): IsoDate {
  return monthRange(monthKey).from;
}

export function endOfMonthIso(monthKey: MonthKey): IsoDate {
  return monthRange(monthKey).to;
}

export function daysInMonth(monthKey: MonthKey): number {
  const range = monthRange(monthKey);
  return differenceInCalendarDays(parseISO(range.to), parseISO(range.from)) + 1;
}

export function daysElapsedInMonth(monthKey: MonthKey, today: IsoDate = todayIso()): number {
  const { from } = monthRange(monthKey);
  const elapsed = differenceInCalendarDays(parseISO(today), parseISO(from)) + 1;
  return Math.min(Math.max(elapsed, 1), daysInMonth(monthKey));
}

export function formatMonthLabel(monthKey: MonthKey, pattern = 'MMMM yyyy'): string {
  return format(parseISO(`${monthKey}-01`), pattern);
}

export function formatMonthShort(monthKey: MonthKey): string {
  return format(parseISO(`${monthKey}-01`), 'MMM');
}

export function formatDayLabel(isoDate: IsoDate, pattern = 'd MMM yyyy'): string {
  return format(parseISO(isoDate), pattern);
}

export function formatDayShort(isoDate: IsoDate): string {
  return format(parseISO(isoDate), 'd MMM');
}

/** 'Today' / 'Yesterday' / '12 Mar' style labels for ledger rows. */
export function relativeDayLabel(isoDate: IsoDate, today: IsoDate = todayIso()): string {
  const diff = differenceInCalendarDays(parseISO(today), parseISO(isoDate));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  return format(parseISO(isoDate), diff < 365 ? 'd MMM' : 'd MMM yyyy');
}

/** Date-range presets offered on the ledger and analytics screens. */
export type RangePreset = 'month' | 'last7' | 'last30' | 'thisYear';

export function resolveRangePreset(
  preset: RangePreset,
  monthKey: MonthKey,
  today: IsoDate = todayIso(),
): DateRange {
  switch (preset) {
    case 'last7':
      return { from: shiftIsoDays(today, -6), to: today };
    case 'last30':
      return { from: shiftIsoDays(today, -29), to: today };
    case 'thisYear':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case 'month':
    default:
      return monthRange(monthKey);
  }
}

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  month: 'Selected month',
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  thisYear: 'This year',
};

export function describeRange(range: DateRange): string {
  if (range.from === range.to) return formatDayLabel(range.from);
  return `${formatDayLabel(range.from, 'd MMM')} – ${formatDayLabel(range.to, 'd MMM yyyy')}`;
}

export function isFutureDate(isoDate: IsoDate, today: IsoDate = todayIso()): boolean {
  return differenceInCalendarDays(parseISO(isoDate), parseISO(today)) > 0;
}


/** Every calendar day in a range, used to plot zero-spend days. */
export function eachDayIso(range: DateRange): IsoDate[] {
  if (parseISO(range.to) < parseISO(range.from)) return [];
  return eachDayOfInterval({ start: parseISO(range.from), end: parseISO(range.to) }).map(toIsoDate);
}

/** Compares two 'yyyy-MM-dd' strings without constructing Date objects. */
export function isWithinRange(isoDate: IsoDate, range: DateRange): boolean {
  return isoDate >= range.from && isoDate <= range.to;
}

export function shiftIsoDays(isoDate: IsoDate, days: number): IsoDate {
  const base = parseISO(isoDate);
  const shifted = new Date(base.getTime());
  shifted.setDate(shifted.getDate() + days);
  return toIsoDate(shifted);
}

/** UTC ISO strings for database timestamps (created_at, expires_at). */
export function nowIsoTimestamp(): string {
  return new Date().toISOString();
}

export function isExpired(isoTimestamp: string, now: Date = new Date()): boolean {
  const value = parseISO(isoTimestamp);
  return isValid(value) ? value.getTime() <= now.getTime() : true;
}
