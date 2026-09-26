/**
 * Ledger helpers: filtering, sorting, pagination, grouping and permissions.
 *
 * The transaction page queries PostgreSQL with server-side filters, ordering and
 * range pagination. These pure helpers exist because (a) the domain rules are
 * worth unit testing, (b) the member detail page and CSV export reuse them, and
 * (c) permission rules must live in one auditable place that mirrors RLS.
 */
import type { PaymentMethod } from '@/types/database';
import type {
  ExpenseQueryFilters,
  ExpenseSortKey,
  ExpenseWithRelations,
  HouseholdRole,
  PeriodTotals,
} from '@/types/domain';
import type { IsoDate } from '@/domain/dates';
import { sumPaise } from '@/domain/money';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  upi: 'UPI',
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  other: 'Other',
};

export const PAYMENT_METHOD_VALUES: PaymentMethod[] = [
  'upi',
  'cash',
  'card',
  'bank_transfer',
  'other',
];

export const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> =
  PAYMENT_METHOD_VALUES.map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] }));

export const EXPENSE_SORT_OPTIONS: Array<{ value: ExpenseSortKey; label: string }> = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'amount_desc', label: 'Highest amount' },
  { value: 'amount_asc', label: 'Lowest amount' },
];

export const DEFAULT_PAGE_SIZE = 20;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** Free-text match across merchant, note, category and spender name. */
export function matchesSearch(expense: ExpenseWithRelations, query: string): boolean {
  const needle = normalize(query);
  if (needle.length === 0) return true;
  const haystack = [
    expense.merchant ?? '',
    expense.note ?? '',
    expense.category?.name ?? '',
    expense.spender?.display_name ?? '',
    (expense.amount_paise / 100).toString(),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function filterExpenses(
  expenses: readonly ExpenseWithRelations[],
  filters: ExpenseQueryFilters,
): ExpenseWithRelations[] {
  return expenses.filter((expense) => {
    if (expense.expense_date < filters.from || expense.expense_date > filters.to) return false;

    if (filters.search && !matchesSearch(expense, filters.search)) return false;

    if (filters.categoryIds && filters.categoryIds.length > 0) {
      const categoryKey = expense.category_id ?? 'uncategorised';
      if (!filters.categoryIds.includes(categoryKey)) return false;
    }

    if (filters.memberIds && filters.memberIds.length > 0) {
      if (!filters.memberIds.includes(expense.spent_by)) return false;
    }

    if (filters.paymentMethods && filters.paymentMethods.length > 0) {
      if (!filters.paymentMethods.includes(expense.payment_method)) return false;
    }

    if (typeof filters.minPaise === 'number' && expense.amount_paise < filters.minPaise) return false;
    if (typeof filters.maxPaise === 'number' && expense.amount_paise > filters.maxPaise) return false;

    return true;
  });
}

export function sortExpenses(
  expenses: readonly ExpenseWithRelations[],
  sort: ExpenseSortKey,
): ExpenseWithRelations[] {
  const rows = [...expenses];
  switch (sort) {
    case 'date_asc':
      return rows.sort(
        (a, b) =>
          a.expense_date.localeCompare(b.expense_date) || a.created_at.localeCompare(b.created_at),
      );
    case 'amount_desc':
      return rows.sort((a, b) => b.amount_paise - a.amount_paise);
    case 'amount_asc':
      return rows.sort((a, b) => a.amount_paise - b.amount_paise);
    case 'date_desc':
    default:
      return rows.sort(
        (a, b) =>
          b.expense_date.localeCompare(a.expense_date) || b.created_at.localeCompare(a.created_at),
      );
  }
}

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize = DEFAULT_PAGE_SIZE,
): Page<T> {
  const safePageSize = Math.max(Math.trunc(pageSize), 1);
  const totalPages = Math.max(Math.ceil(items.length / safePageSize), 1);
  const safePage = Math.min(Math.max(Math.trunc(page), 1), totalPages);
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    total: items.length,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  };
}

export type ExpenseDayGroup = {
  day: IsoDate;
  total_paise: number;
  count: number;
  items: ExpenseWithRelations[];
};

/** Groups an already-sorted list into day sections (newest day first). */
export function groupExpensesByDay(
  expenses: readonly ExpenseWithRelations[],
): ExpenseDayGroup[] {
  const groups = new Map<IsoDate, ExpenseWithRelations[]>();
  for (const expense of expenses) {
    const bucket = groups.get(expense.expense_date);
    if (bucket) bucket.push(expense);
    else groups.set(expense.expense_date, [expense]);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, items]) => ({
      day,
      items,
      count: items.length,
      total_paise: sumPaise(items.map((item) => item.amount_paise)),
    }));
}

export function summarizeExpenses(expenses: readonly ExpenseWithRelations[]): PeriodTotals {
  if (expenses.length === 0) {
    return {
      total_paise: 0,
      expense_count: 0,
      member_count: 0,
      largest_expense_paise: 0,
      average_expense_paise: 0,
    };
  }
  const total = sumPaise(expenses.map((expense) => expense.amount_paise));
  return {
    total_paise: total,
    expense_count: expenses.length,
    member_count: new Set(expenses.map((expense) => expense.spent_by)).size,
    largest_expense_paise: Math.max(...expenses.map((expense) => expense.amount_paise)),
    average_expense_paise: Math.round(total / expenses.length),
  };
}

/**
 * Mirrors the `expenses_update_*` / `expenses_delete_*` policies so the UI hides
 * actions the database would reject anyway: a member owns their own rows, the
 * household owner administers everyone's.
 */
export function canEditExpense(
  expense: Pick<ExpenseWithRelations, 'spent_by'>,
  userId: string,
  role: HouseholdRole,
): boolean {
  return expense.spent_by === userId || role === 'owner';
}

export function canDeleteExpense(
  expense: Pick<ExpenseWithRelations, 'spent_by'>,
  userId: string,
  role: HouseholdRole,
): boolean {
  return canEditExpense(expense, userId, role);
}

/** True when the signed-in member may record spend on behalf of someone else. */
export function canRecordForOthers(role: HouseholdRole): boolean {
  return role === 'owner';
}

export function countActiveFilters(filters: ExpenseQueryFilters): number {
  let count = 0;
  if (filters.search && filters.search.trim().length > 0) count += 1;
  if (filters.categoryIds && filters.categoryIds.length > 0) count += 1;
  if (filters.memberIds && filters.memberIds.length > 0) count += 1;
  if (filters.paymentMethods && filters.paymentMethods.length > 0) count += 1;
  if (typeof filters.minPaise === 'number' || typeof filters.maxPaise === 'number') count += 1;
  return count;
}

