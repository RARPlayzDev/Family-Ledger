import { z } from 'zod';
import { isFutureDate, isIsoDate } from '@/domain/dates';
import { parseRupeeInput } from '@/domain/money';
import type { ExpenseWithRelations } from '@/types/domain';
import type { PaymentMethod } from '@/types/database';

/**
 * Validation for the expense form.
 *
 * The amount is validated as TEXT and converted to integer paise with
 * `parseRupeeInput`, so no floating point rounding can ever reach the database.
 */

/** Sentinel used because Radix Select cannot hold an empty string value. */
export const NO_CATEGORY = '__none__';

export const PAYMENT_METHODS: PaymentMethod[] = ['upi', 'cash', 'card', 'bank_transfer', 'other'];

export const expenseFormSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, 'Enter an amount')
    .superRefine((value, ctx) => {
      if (parseRupeeInput(value) === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Enter a valid amount, e.g. 1250 or 1250.50',
        });
      }
    }),
  expense_date: z
    .string()
    .trim()
    .refine((value) => isIsoDate(value), 'Choose a valid date')
    .refine((value) => !isFutureDate(value), 'The date cannot be in the future'),
  category_id: z.string().trim().min(1, 'Choose a category'),
  spent_by: z.string().uuid('Choose which family member spent this'),
  merchant: z.string().trim().max(120, 'Keep the merchant under 120 characters'),
  note: z.string().trim().max(500, 'Keep the note under 500 characters'),
  payment_method: z.enum(['upi', 'cash', 'card', 'bank_transfer', 'other']),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export function categoryIdFromFormValue(value: string): string | null {
  return value === NO_CATEGORY ? null : value;
}

export function parseAmountToPaise(value: string): number | null {
  return parseRupeeInput(value);
}

/** Turns validated form values into the payload the service expects. */
export function toExpenseWriteInput(
  values: ExpenseFormValues,
  householdId: string,
): {
  householdId: string;
  spentBy: string;
  amountPaise: number;
  expenseDate: string;
  categoryId: string | null;
  merchant: string | null;
  note: string | null;
  paymentMethod: PaymentMethod;
} {
  const amountPaise = parseRupeeInput(values.amount);
  if (amountPaise === null) {
    throw new Error('Enter a valid amount, e.g. 1250 or 1250.50');
  }

  return {
    householdId,
    spentBy: values.spent_by,
    amountPaise,
    expenseDate: values.expense_date,
    categoryId: categoryIdFromFormValue(values.category_id),
    merchant: values.merchant.trim().length > 0 ? values.merchant.trim() : null,
    note: values.note.trim().length > 0 ? values.note.trim() : null,
    paymentMethod: values.payment_method,
  };
}

/** Defaults when adding a new expense in the household's own day. */
export function emptyExpenseValues(params: {
  today: string;
  memberId: string;
  categoryId?: string | null;
  paymentMethod?: PaymentMethod;
}): ExpenseFormValues {
  return {
    amount: '',
    expense_date: params.today,
    category_id: params.categoryId ?? NO_CATEGORY,
    spent_by: params.memberId,
    merchant: '',
    note: '',
    payment_method: params.paymentMethod ?? 'upi',
  };
}

/** Prefills the form when editing an existing expense. */
export function expenseValuesFromRow(expense: ExpenseWithRelations): ExpenseFormValues {
  return {
    amount: (expense.amount_paise / 100).toFixed(
      expense.amount_paise % 100 === 0 ? 0 : 2,
    ),
    expense_date: expense.expense_date,
    category_id: expense.category_id ?? NO_CATEGORY,
    spent_by: expense.spent_by,
    merchant: expense.merchant ?? '',
    note: expense.note ?? '',
    payment_method: expense.payment_method,
  };
}
