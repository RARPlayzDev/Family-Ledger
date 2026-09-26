/**
 * CSV export.
 *
 * Escaping is implemented explicitly (RFC 4180) rather than relying on a
 * library, and CRLF line endings keep the file happy in Excel, Numbers and
 * Google Sheets alike. Amounts are exported in both rupees and exact paise so
 * the export is round-trippable without floating point loss.
 */
import { PAISE_PER_RUPEE } from '@/domain/money';
import { PAYMENT_METHOD_LABELS } from '@/domain/expenses';
import type { ExpenseWithRelations } from '@/types/domain';

export const EXPENSE_CSV_HEADERS = [
  'Date',
  'Amount (INR)',
  'Amount (paise)',
  'Category',
  'Spent by',
  'Merchant',
  'Payment method',
  'Note',
  'Recorded at',
] as const;

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'number' ? String(value) : value;
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>,
): string {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }
  // Trailing newline keeps the last row from being swallowed by some tools.
  return `${lines.join('\r\n')}\r\n`;
}

export function expensesToCsvRows(
  expenses: readonly ExpenseWithRelations[],
): Array<Array<string | number | null>> {
  return expenses.map((expense) => [
    expense.expense_date,
    (expense.amount_paise / PAISE_PER_RUPEE).toFixed(2),
    expense.amount_paise,
    expense.category?.name ?? 'Uncategorised',
    expense.spender?.display_name ?? 'Unknown member',
    expense.merchant ?? '',
    PAYMENT_METHOD_LABELS[expense.payment_method],
    expense.note ?? '',
    expense.created_at,
  ]);
}

export function expensesToCsv(expenses: readonly ExpenseWithRelations[]): string {
  return toCsv(EXPENSE_CSV_HEADERS, expensesToCsvRows(expenses));
}

/** 'familyledger-2026-03.csv' */
export function csvFileName(prefix: string, monthKey: string): string {
  return `${prefix}-${monthKey}.csv`;
}
