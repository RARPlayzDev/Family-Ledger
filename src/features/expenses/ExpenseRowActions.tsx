import { useState } from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteExpense } from '@/hooks/use-expenses';
import { useHousehold } from '@/hooks/use-household';
import { useSession } from '@/hooks/use-session';
import { useToast } from '@/hooks/use-toast';
import { canDeleteExpense } from '@/domain/expenses';
import { errorMessage } from '@/lib/errors';
import { formatDayLabel } from '@/domain/dates';
import { Money } from '@/components/shared/money';
import type { ExpenseWithRelations } from '@/types/domain';

/**
 * Row actions.
 *
 * The edit/delete affordances mirror the RLS rules exactly
 * (`canEditExpense`): members manage their own rows, the household owner manages
 * every row in the shared ledger. Anything the user cannot do is not rendered,
 * and the database would reject it anyway.
 */
export function ExpenseRowActions({
  expense,
  onEdit,
}: {
  expense: ExpenseWithRelations;
  onEdit: (expense: ExpenseWithRelations) => void;
}) {
  const { userId } = useSession();
  const { householdId, role } = useHousehold();
  const deleteMutation = useDeleteExpense();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const allowed = canDeleteExpense(expense, userId ?? '', role ?? 'member');
  if (!allowed || !householdId) return null;

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ expenseId: expense.id, householdId });
      toast.push({ title: 'Expense deleted', tone: 'success' });
      setConfirmOpen(false);
    } catch (error) {
      toast.push({
        title: 'Could not delete the expense',
        description: errorMessage(error),
        tone: 'error',
      });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Expense actions">
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onEdit(expense)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            tone="danger"
            onSelect={(event) => {
              event.preventDefault();
              setConfirmOpen(true);
            }}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                <Money paise={expense.amount_paise} className="text-content" />
                {expense.category ? ` · ${expense.category.name}` : ''}
                {expense.merchant ? ` · ${expense.merchant}` : ''}
              </span>
              <span className="mt-2 block">
                Recorded {formatDayLabel(expense.expense_date)}. Deleting removes it from the shared
                ledger for every family member and cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete expense'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
