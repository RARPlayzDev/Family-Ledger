import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { IndianRupee } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { CategoryIcon } from '@/components/shared/category-icon';
import { Money } from '@/components/shared/money';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCategories } from '@/hooks/use-categories';
import { useCreateExpense, useUpdateExpense } from '@/hooks/use-expenses';
import { useHousehold } from '@/hooks/use-household';
import { useSession } from '@/hooks/use-session';
import { useToast } from '@/hooks/use-toast';
import { todayIsoInTimeZone } from '@/domain/dates';
import { PAYMENT_METHOD_LABELS } from '@/domain/expenses';
import { errorMessage } from '@/lib/errors';
import { memberSummaryOf } from '@/services/households.service';
import type { ExpenseWithRelations } from '@/types/domain';
import {
  NO_CATEGORY,
  PAYMENT_METHODS,
  emptyExpenseValues,
  expenseFormSchema,
  expenseValuesFromRow,
  parseAmountToPaise,
  toExpenseWriteInput,
  type ExpenseFormValues,
} from '@/features/expenses/schema';

export type ExpenseFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent when adding. */
  expense: ExpenseWithRelations | null;
  presetDate?: string;
  /** Pre-selected category (used by the budgets page shortcuts). */
  presetCategoryId?: string | null;
};

/**
 * Add / edit expense dialog.
 *
 * One dialog covers both directions of the shared ledger: any member records
 * their own spend, while the household owner may record or reassign spend for
 * another member (the database enforces the same rule - see guard_expense).
 */
export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
  presetDate,
  presetCategoryId,
}: ExpenseFormDialogProps) {
  const { householdId, isOwner, members, membersLoading, timezone } = useHousehold();
  const { userId } = useSession();
  const toast = useToast();
  const categoriesQuery = useCategories(householdId);
  const createMutation = useCreateExpense();
  const updateMutation = useUpdateExpense();

  const today = todayIsoInTimeZone(timezone);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: emptyExpenseValues({
      today: presetDate ?? today,
      memberId: userId ?? '',
      categoryId: presetCategoryId,
    }),
  });

  // Reset whenever the dialog opens so a cancelled edit never leaks stale values.
  useEffect(() => {
    if (!open) return;
    if (expense) {
      form.reset(expenseValuesFromRow(expense));
      return;
    }
    form.reset(
      emptyExpenseValues({
        today: presetDate ?? today,
        memberId: userId ?? '',
        categoryId: presetCategoryId,
      }),
    );
  }, [open, expense, presetDate, presetCategoryId, today, userId, form]);

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const amountPreview = parseAmountToPaise(form.watch('amount') ?? '');
  const memberOptions = membersLoading
    ? []
    : members.map((member) => ({ id: member.user_id, summary: memberSummaryOf(member) }));

  const onSubmit = form.handleSubmit(async (values) => {
    if (!householdId) {
      toast.push({ title: 'No household selected', tone: 'error' });
      return;
    }

    try {
      const payload = toExpenseWriteInput(values, householdId);
      if (expense) {
        await updateMutation.mutateAsync({
          expenseId: expense.id,
          householdId,
          values: {
            spentBy: payload.spentBy,
            amountPaise: payload.amountPaise,
            expenseDate: payload.expenseDate,
            categoryId: payload.categoryId,
            merchant: payload.merchant,
            note: payload.note,
            paymentMethod: payload.paymentMethod,
          },
        });
        toast.push({ title: 'Expense updated', tone: 'success' });
      } else {
        await createMutation.mutateAsync(payload);
        toast.push({ title: 'Expense added to the family ledger', tone: 'success' });
      }
      onOpenChange(false);
    } catch (error) {
      toast.push({
        title: expense ? 'Could not update the expense' : 'Could not add the expense',
        description: errorMessage(error),
        tone: 'error',
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{expense ? 'Edit expense' : 'Add expense'}</DialogTitle>
          <DialogDescription>
            {expense
              ? 'Changes are visible to every member of the household.'
              : 'This is recorded in the shared household ledger.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="expense-amount">Amount (₹)</Label>
              <div className="relative">
                <IndianRupee className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-content-subtle" />
                <Input
                  id="expense-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  className="num pl-9 text-base"
                  invalid={Boolean(form.formState.errors.amount)}
                  {...form.register('amount')}
                />
              </div>
              {form.formState.errors.amount ? (
                <p className="text-2xs text-danger">{form.formState.errors.amount.message}</p>
              ) : (
                <p className="text-2xs text-content-subtle">
                  {amountPreview !== null ? (
                    <>
                      Stored as <Money paise={amountPreview} decimals={2} /> (integer paise)
                    </>
                  ) : (
                    'Rupees only · up to 2 decimals'
                  )}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense-date">Date</Label>
              <Input
                id="expense-date"
                type="date"
                max={today}
                invalid={Boolean(form.formState.errors.expense_date)}
                {...form.register('expense_date')}
              />
              {form.formState.errors.expense_date ? (
                <p className="text-2xs text-danger">{form.formState.errors.expense_date.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="expense-category">Category</Label>
              <Controller
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="expense-category"
                      invalid={Boolean(form.formState.errors.category_id)}
                    >
                      <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>Uncategorised</SelectItem>
                      {(categoriesQuery.data ?? [])
                        .filter((category) => category.is_active)
                        .map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            <span className="flex items-center gap-2">
                              <CategoryIcon name={category.icon} color={category.color} size="sm" />
                              {category.name}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense-member">Who spent it</Label>
              <Controller
                control={form.control}
                name="spent_by"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!isOwner && memberOptions.length > 0}
                  >
                    <SelectTrigger
                      id="expense-member"
                      invalid={Boolean(form.formState.errors.spent_by)}
                    >
                      <SelectValue placeholder="Choose a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {memberOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.summary.display_name}
                          {option.id === userId ? ' (you)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {!isOwner ? (
                <p className="text-2xs text-content-subtle">
                  Members record their own expenses. The owner can record for anyone.
                </p>
              ) : null}
            </div>
          </div>


          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="expense-merchant">Merchant</Label>
              <Input
                id="expense-merchant"
                placeholder="e.g. Big Bazaar"
                autoComplete="off"
                invalid={Boolean(form.formState.errors.merchant)}
                {...form.register('merchant')}
              />
              {form.formState.errors.merchant ? (
                <p className="text-2xs text-danger">{form.formState.errors.merchant.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense-payment">Payment method</Label>
              <Controller
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="expense-payment">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>
                          {PAYMENT_METHOD_LABELS[method]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-note">Note</Label>
            <Textarea
              id="expense-note"
              placeholder="Optional details the family should know"
              invalid={Boolean(form.formState.errors.note)}
              {...form.register('note')}
            />
            {form.formState.errors.note ? (
              <p className="text-2xs text-danger">{form.formState.errors.note.message}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={isSaving}>
              {isSaving ? <Spinner className="text-accent-ink" /> : null}
              {expense ? 'Save changes' : 'Add expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

