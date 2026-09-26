import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExpenseFilterFields, EMPTY_LEDGER_FILTERS } from '@/features/expenses/ExpenseFilterFields';
import { EXPENSE_SORT_OPTIONS, countActiveFilters } from '@/domain/expenses';
import type { Category, ExpenseQueryFilters, ExpenseSortKey, MemberSummary } from '@/types/domain';

export type ExpenseFiltersProps = {
  filters: ExpenseQueryFilters;
  onFiltersChange: (next: ExpenseQueryFilters) => void;
  sort: ExpenseSortKey;
  onSortChange: (next: ExpenseSortKey) => void;
  categories: Category[];
  members: MemberSummary[];
  onReset: () => void;
  resultLabel?: string;
};

/**
 * Ledger filter bar.
 *
 * Search and sort stay on the bar (used constantly); the rest lives in an inline
 * panel on desktop and a bottom drawer on mobile so the controls never crush the
 * list on a phone.
 */
export function ExpenseFilters({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  categories,
  members,
  onReset,
  resultLabel,
}: ExpenseFiltersProps) {
  const activeCount = countActiveFilters(filters);

  const clearAll = () => {
    onFiltersChange({ ...filters, ...EMPTY_LEDGER_FILTERS });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-content-subtle" />
          <Input
            value={filters.search ?? ''}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            placeholder="Search merchant or note"
            aria-label="Search transactions"
            className="pl-9"
          />
        </div>

        <Select value={sort} onValueChange={(value) => onSortChange(value as ExpenseSortKey)}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Sort transactions">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPENSE_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary" className="lg:hidden">
              <SlidersHorizontal />
              Filters
              {activeCount > 0 ? <Badge tone="accent">{activeCount}</Badge> : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="lg:hidden">
            <SheetHeader>
              <SheetTitle>Filter the ledger</SheetTitle>
              <SheetDescription>
                Filters apply to the shared household ledger for the selected period.
              </SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto pr-1">
              <ExpenseFilterFields
                filters={filters}
                onFiltersChange={onFiltersChange}
                categories={categories}
                members={members}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={clearAll}>
                Clear all
              </Button>
              <SheetClose asChild>
                <Button className="flex-1">Show {resultLabel ?? 'results'}</Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>

        {activeCount > 0 ? (
          <Button variant="ghost" onClick={onReset} className="hidden lg:inline-flex">
            <X />
            Clear
          </Button>
        ) : null}
      </div>

      {/* Desktop keeps the filters visible so each toggle has an obvious effect. */}
      <div className="hidden rounded-lg border border-line bg-surface p-4 lg:block">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="border-line lg:border-r lg:pr-6">
            <ExpenseFilterFields
              filters={filters}
              onFiltersChange={onFiltersChange}
              categories={categories}
              members={members}
            />
          </div>
          <div className="lg:col-span-2">
            <p className="text-2xs leading-relaxed text-content-subtle">
              The ledger always shows the household's shared expenses. Turn on a member to see what
              that person spent, or pick categories to audit a part of the month. Amount ranges are
              exact: they are compared against the stored integer paise, never a rounded rupee value.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
