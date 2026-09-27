import type { ReactNode } from 'react';
import { Receipt } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryIcon } from '@/components/shared/category-icon';
import { Money } from '@/components/shared/money';
import { ExpenseRowActions } from '@/features/expenses/ExpenseRowActions';
import { ExpenseTable } from '@/features/expenses/ExpenseTable';
import { useExpenseComposer } from '@/features/expenses/use-expense-composer';
import { PAYMENT_METHOD_LABELS } from '@/domain/expenses';
import { relativeDayLabel } from '@/domain/dates';
import type { ExpenseWithRelations } from '@/types/domain';

/**
 * The ledger list.
 *
 * Cards on phones (big tap targets, no horizontal scrolling) and a dense table
 * from `lg` upwards; both render the same rows and the same row actions.
 */
function primaryLabel(expense: ExpenseWithRelations): string {
  return expense.merchant?.trim() || expense.category?.name || 'Expense';
}

function secondaryLabel(expense: ExpenseWithRelations): string {
  const parts: string[] = [];
  if (expense.merchant?.trim() && expense.category) parts.push(expense.category.name);
  parts.push(expense.spender?.display_name ?? 'Member');
  parts.push(PAYMENT_METHOD_LABELS[expense.payment_method]);
  return parts.join(' · ');
}

export function ExpenseList({
  expenses,
  isLoading = false,
  emptyTitle = 'No expenses in this period',
  emptyDescription = 'Add the first expense and every family member will see it immediately.',
  emptyAction,
}: {
  expenses: ExpenseWithRelations[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}) {
  const composer = useExpenseComposer();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <EmptyState
        icon={<Receipt />}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <>
      {/* Mobile: stacked cards */}
      <ul className="space-y-2 lg:hidden">
        {expenses.map((expense) => (
          <li key={expense.id}>
            <Card className="flex items-center gap-3 p-3">
              <CategoryIcon name={expense.category?.icon} color={expense.category?.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-content">{primaryLabel(expense)}</p>
                <p className="truncate text-2xs text-content-muted">{secondaryLabel(expense)}</p>
                <p className="mt-0.5 text-2xs text-content-subtle">
                  {relativeDayLabel(expense.expense_date)}
                </p>
              </div>
              {/* Amount above its own 44px action button: the row stays legible and
                  the menu is still reachable with a thumb. */}
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <Money paise={expense.amount_paise} className="text-sm font-semibold" />
                <ExpenseRowActions expense={expense} onEdit={composer.openEdit} />
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {/* Desktop: data table */}
      <div className="hidden lg:block">
        <ExpenseTable expenses={expenses} />
      </div>
    </>
  );
}
