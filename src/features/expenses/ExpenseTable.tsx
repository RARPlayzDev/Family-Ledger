import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CategoryIcon } from '@/components/shared/category-icon';
import { Money } from '@/components/shared/money';
import { ExpenseRowActions } from '@/features/expenses/ExpenseRowActions';
import { useExpenseComposer } from '@/features/expenses/use-expense-composer';
import { PAYMENT_METHOD_LABELS } from '@/domain/expenses';
import { relativeDayLabel } from '@/domain/dates';
import type { ExpenseWithRelations } from '@/types/domain';

const COLUMNS = ['Date', 'Expense', 'Category', 'Member', 'Method'] as const;

function primaryLabel(expense: ExpenseWithRelations): string {
  return expense.merchant?.trim() || expense.category?.name || 'Expense';
}

/** Desktop ledger table. Reused by the ledger page and the member detail page. */
export function ExpenseTable({ expenses }: { expenses: ExpenseWithRelations[] }) {
  const composer = useExpenseComposer();

  return (
    <Card className="overflow-hidden">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            {COLUMNS.map((heading) => (
              <th
                key={heading}
                className="px-3 py-2 text-left text-2xs font-medium uppercase tracking-[0.06em] text-content-subtle"
              >
                {heading}
              </th>
            ))}
            <th className="px-3 py-2 text-right text-2xs font-medium uppercase tracking-[0.06em] text-content-subtle">
              Amount
            </th>
            <th className="w-12 px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {expenses.map((expense) => (
            <tr key={expense.id} className="transition-colors hover:bg-surface-raised/60">
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-content-muted">
                {relativeDayLabel(expense.expense_date)}
              </td>
              <td className="px-3 py-2.5">
                <p className="text-sm text-content">{primaryLabel(expense)}</p>
                {expense.note ? (
                  <p className="max-w-md truncate text-2xs text-content-subtle">{expense.note}</p>
                ) : null}
              </td>
              <td className="px-3 py-2.5">
                <span className="flex items-center gap-2 text-xs text-content-muted">
                  <CategoryIcon
                    name={expense.category?.icon}
                    color={expense.category?.color}
                    size="sm"
                  />
                  {expense.category?.name ?? 'Uncategorised'}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <span className="flex items-center gap-2 text-xs text-content-muted">
                  <Avatar
                    name={expense.spender?.display_name ?? 'Member'}
                    src={expense.spender?.avatar_url ?? null}
                    size="sm"
                  />
                  {expense.spender?.display_name ?? 'Member'}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <Badge>{PAYMENT_METHOD_LABELS[expense.payment_method]}</Badge>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right">
                <Money paise={expense.amount_paise} className="text-sm font-semibold" />
              </td>
              <td className="px-1 py-2.5 text-right">
                <ExpenseRowActions expense={expense} onEdit={composer.openEdit} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
