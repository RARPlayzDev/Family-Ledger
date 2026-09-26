import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ExpenseWithRelations } from '@/types/domain';
import { ExpenseFormDialog } from '@/features/expenses/ExpenseFormDialog';

/**
 * Global expense composer.
 *
 * The "add expense" action must be reachable from every screen (top bar on
 * mobile and desktop, dashboard shortcuts, empty states, budget rows) without
 * each page owning a copy of the dialog. The provider renders one dialog instance
 * and hands out imperative openers.
 */

type ComposerTarget = {
  expense: ExpenseWithRelations | null;
  presetDate?: string;
  presetCategoryId?: string | null;
};

export type ExpenseComposerContextValue = {
  openCreate: (options?: { date?: string; categoryId?: string | null }) => void;
  openEdit: (expense: ExpenseWithRelations) => void;
  close: () => void;
  isOpen: boolean;
};

const ExpenseComposerContext = createContext<ExpenseComposerContextValue | null>(null);

export function ExpenseComposerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<ComposerTarget>({ expense: null });

  const openCreate = useCallback((options?: { date?: string; categoryId?: string | null }) => {
    setTarget({
      expense: null,
      presetDate: options?.date,
      presetCategoryId: options?.categoryId,
    });
    setOpen(true);
  }, []);

  const openEdit = useCallback((expense: ExpenseWithRelations) => {
    setTarget({ expense });
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const value = useMemo<ExpenseComposerContextValue>(
    () => ({ openCreate, openEdit, close, isOpen: open }),
    [openCreate, openEdit, close, open],
  );

  return (
    <ExpenseComposerContext.Provider value={value}>
      {children}
      <ExpenseFormDialog
        open={open}
        onOpenChange={setOpen}
        expense={target.expense}
        presetDate={target.presetDate}
        presetCategoryId={target.presetCategoryId}
      />
    </ExpenseComposerContext.Provider>
  );
}

export function useExpenseComposer(): ExpenseComposerContextValue {
  const context = useContext(ExpenseComposerContext);
  if (!context) {
    throw new Error('useExpenseComposer must be used inside <ExpenseComposerProvider>');
  }
  return context;
}
