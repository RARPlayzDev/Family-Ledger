import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, Download, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/page-header';
import { MonthPicker } from '@/components/shared/month-picker';
import { ExpenseFilters } from '@/features/expenses/ExpenseFilters';
import { ExpenseList } from '@/features/expenses/ExpenseList';
import { EMPTY_LEDGER_FILTERS } from '@/features/expenses/ExpenseFilterFields';
import { useExpenseComposer } from '@/features/expenses/use-expense-composer';
import { useExportExpenses, useExpensePage, usePeriodTotals } from '@/hooks/use-expenses';
import { useCategories } from '@/hooks/use-categories';
import { useHousehold } from '@/hooks/use-household';
import { useToast } from '@/hooks/use-toast';
import { Money } from '@/components/shared/money';
import {
  RANGE_PRESET_LABELS,
  currentMonthKey,
  describeRange,
  resolveRangePreset,
  type RangePreset,
} from '@/domain/dates';
import { csvFileName, expensesToCsv } from '@/domain/csv';
import { formatINR } from '@/domain/money';
import { downloadTextFile } from '@/lib/download';
import { errorMessage } from '@/lib/errors';
import { memberSummaryOf } from '@/services/households.service';
import type { ExpenseQueryFilters, ExpenseSortKey } from '@/types/domain';

const PRESETS: RangePreset[] = ['month', 'last7', 'last30', 'thisYear'];

/**
 * The shared ledger.
 *
 * This is the household's single source of truth: everyone sees every expense, and
 * the filters (member, category, method, amount) are simply different slices of the
 * same data. Paging, sorting and filtering all happen in PostgreSQL.
 */
export function TransactionsPage() {
  const { householdId, members } = useHousehold();
  const toast = useToast();
  const composer = useExpenseComposer();

  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [preset, setPreset] = useState<RangePreset>('month');
  const [sort, setSort] = useState<ExpenseSortKey>('date_desc');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ExpenseQueryFilters>({
    from: resolveRangePreset('month', currentMonthKey()).from,
    to: resolveRangePreset('month', currentMonthKey()).to,
    ...EMPTY_LEDGER_FILTERS,
  });

  const range = useMemo(() => resolveRangePreset(preset, monthKey), [preset, monthKey]);

  // Keep the query range in sync with the picker, and restart at page 1.
  useEffect(() => {
    setFilters((current) => ({ ...current, from: range.from, to: range.to }));
    setPage(1);
  }, [range.from, range.to]);

  const categoriesQuery = useCategories(householdId);
  const categories = categoriesQuery.data ?? [];
  const memberSummaries = useMemo(() => members.map(memberSummaryOf), [members]);

  const pageQuery = useExpensePage({ householdId, filters, sort, page });
  const totalsQuery = usePeriodTotals({ householdId, from: range.from, to: range.to });
  const exportMutation = useExportExpenses();

  const expenses = pageQuery.data?.items ?? [];
  const totalCount = pageQuery.data?.total ?? 0;
  const totalPages = pageQuery.data?.totalPages ?? 1;
  const totals = totalsQuery.data;

  const resetFilters = () => setFilters((current) => ({ ...current, ...EMPTY_LEDGER_FILTERS }));

  const handleExport = async () => {
    if (!householdId) return;
    try {
      const rows = await exportMutation.mutateAsync({
        householdId,
        from: range.from,
        to: range.to,
        limit: 5000,
      });
      if (rows.length === 0) {
        toast.push({ title: 'Nothing to export for this period', tone: 'default' });
        return;
      }
      downloadTextFile({
        fileName: csvFileName('familyledger-ledger', monthKey),
        content: expensesToCsv(rows),
      });
      toast.push({
        title: `Exported ${rows.length} expense${rows.length === 1 ? '' : 's'}`,
        description: 'The CSV contains both rupee and exact paise columns.',
        tone: 'success',
      });
    } catch (error) {
      toast.push({ title: 'Export failed', description: errorMessage(error), tone: 'error' });
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Transactions"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{describeRange(range)}</span>
            <span className="text-content-subtle">·</span>
            <span>
              {totalCount} {totalCount === 1 ? 'expense' : 'expenses'} from the shared household ledger
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => void handleExport()} disabled={exportMutation.isPending}>
              <Download />
              <span className="hidden sm:inline">{exportMutation.isPending ? 'Exporting…' : 'Export CSV'}</span>
            </Button>
            <Button onClick={() => composer.openCreate({ date: range.to })}>
              <Plus />
              <span className="hidden sm:inline">Add expense</span>
            </Button>
          </>
        }
      />

      <Card className="flex flex-wrap items-center gap-2 p-3">
        <MonthPicker value={monthKey} onChange={setMonthKey} />
        <div className="flex flex-wrap items-center gap-1">
          {PRESETS.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={preset === option ? 'primary' : 'ghost'}
              onClick={() => setPreset(option)}
            >
              {RANGE_PRESET_LABELS[option]}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-content-muted">
          <span className="flex items-center gap-1.5">
            <CalendarRange className="size-3.5" />
            {totals ? (
              <>
                <Money paise={totals.total_paise} className="font-medium text-content" />
                <span className="text-content-subtle">
                  spent by {totals.member_count} {totals.member_count === 1 ? 'member' : 'members'}
                </span>
              </>
            ) : (
              'Loading totals…'
            )}
          </span>
        </div>
      </Card>

      <ExpenseFilters
        filters={filters}
        onFiltersChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
        categories={categories}
        members={memberSummaries}
        onReset={resetFilters}
        resultLabel={`${totalCount} ${totalCount === 1 ? 'expense' : 'expenses'}`}
      />

      {pageQuery.isError ? (
        <Card className="border-danger/30 p-4 text-xs text-content-muted">
          {errorMessage(pageQuery.error)}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => void pageQuery.refetch()}>
            Retry
          </Button>
        </Card>
      ) : null}

      <ExpenseList
        expenses={expenses}
        isLoading={pageQuery.isLoading}
        emptyTitle={totalCount === 0 ? 'No expenses in this period' : 'No expenses match these filters'}
        emptyDescription="Everyone in the household shares this ledger, so a new expense is visible to the whole family straight away."
        emptyAction={
          <Button size="sm" onClick={() => composer.openCreate({ date: range.to })}>
            <Plus />
            Add the first expense
          </Button>
        }
      />

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-content-muted">
            Page {pageQuery.data?.page ?? 1} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1 || pageQuery.isFetching}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
            >
              <ChevronLeft />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages || pageQuery.isFetching}
              onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
            >
              Next
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}

      {totals && totals.expense_count > 0 ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs leading-relaxed text-content-subtle">
          <span>Average expense {formatINR(totals.average_expense_paise, { decimals: 0 })}</span>
          <span>·</span>
          <span>largest {formatINR(totals.largest_expense_paise, { decimals: 0 })}</span>
          {totals.member_count > 0 ? (
            <>
              <span>·</span>
              <Badge tone="accent">{totals.member_count} contributing members</Badge>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

