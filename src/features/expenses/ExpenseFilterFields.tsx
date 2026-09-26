import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CategoryDot } from '@/components/shared/category-icon';
import { PAYMENT_METHOD_OPTIONS } from '@/domain/expenses';
import { parseRupeeInput } from '@/domain/money';
import type { Category, ExpenseQueryFilters, MemberSummary } from '@/types/domain';
import type { PaymentMethod } from '@/types/database';

export function toggleFilterValue<T>(list: T[] | undefined, value: T): T[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

export const EMPTY_LEDGER_FILTERS: Pick<
  ExpenseQueryFilters,
  'search' | 'categoryIds' | 'memberIds' | 'paymentMethods' | 'minPaise' | 'maxPaise'
> = {
  search: '',
  categoryIds: [],
  memberIds: [],
  paymentMethods: [],
  minPaise: null,
  maxPaise: null,
};

/**
 * The filter controls themselves.
 *
 * Extracted so the desktop panel and the mobile drawer render the same state
 * machine - there is no second implementation that can drift out of sync.
 */
export function ExpenseFilterFields({
  filters,
  onFiltersChange,
  categories,
  members,
}: {
  filters: ExpenseQueryFilters;
  onFiltersChange: (next: ExpenseQueryFilters) => void;
  categories: Category[];
  members: MemberSummary[];
}) {
  const amountToPaise = (value: string): number | null =>
    value.trim().length === 0 ? null : parseRupeeInput(value);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Category</Label>
        <div className="flex flex-wrap gap-1.5">
          {categories.length === 0 ? (
            <span className="text-2xs text-content-subtle">No categories available yet.</span>
          ) : null}
          {categories.map((category) => {
            const selected = (filters.categoryIds ?? []).includes(category.id);
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    categoryIds: toggleFilterValue(filters.categoryIds, category.id),
                  })
                }
                className={`inline-flex min-touch items-center gap-1.5 rounded-md border px-2.5 text-2xs transition-colors ${
                  selected
                    ? 'border-accent/40 bg-accent-soft text-accent'
                    : 'border-line bg-surface-raised text-content-muted hover:border-line-strong'
                }`}
              >
                <CategoryDot color={category.color} />
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Family member</Label>
        <div className="flex flex-wrap gap-1.5">
          {members.map((member) => {
            const selected = (filters.memberIds ?? []).includes(member.id);
            return (
              <button
                key={member.id}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    memberIds: toggleFilterValue(filters.memberIds, member.id),
                  })
                }
                className={`min-touch rounded-md border px-2.5 text-2xs transition-colors ${
                  selected
                    ? 'border-accent/40 bg-accent-soft text-accent'
                    : 'border-line bg-surface-raised text-content-muted hover:border-line-strong'
                }`}
              >
                {member.display_name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Payment method</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="w-full justify-between sm:w-auto">
              {(filters.paymentMethods ?? []).length === 0
                ? 'Any method'
                : `${(filters.paymentMethods ?? []).length} selected`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Payment methods</DropdownMenuLabel>
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={(filters.paymentMethods ?? []).includes(option.value)}
                onCheckedChange={() =>
                  onFiltersChange({
                    ...filters,
                    paymentMethods: toggleFilterValue<PaymentMethod>(
                      filters.paymentMethods,
                      option.value,
                    ),
                  })
                }
                onSelect={(event) => event.preventDefault()}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={false}
              onCheckedChange={() => onFiltersChange({ ...filters, paymentMethods: [] })}
              onSelect={(event) => event.preventDefault()}
            >
              Clear methods
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-min">Amount range (₹)</Label>
        <div className="flex items-center gap-2">
          <Input
            id="filter-min"
            key={`min-${filters.minPaise ?? 'none'}`}
            inputMode="decimal"
            placeholder="Min"
            className="num"
            defaultValue={
              typeof filters.minPaise === 'number' ? String(filters.minPaise / 100) : ''
            }
            onBlur={(event) =>
              onFiltersChange({ ...filters, minPaise: amountToPaise(event.target.value) })
            }
          />
          <span className="text-content-subtle">–</span>
          <Input
            key={`max-${filters.maxPaise ?? 'none'}`}
            inputMode="decimal"
            placeholder="Max"
            aria-label="Maximum amount"
            className="num"
            defaultValue={
              typeof filters.maxPaise === 'number' ? String(filters.maxPaise / 100) : ''
            }
            onBlur={(event) =>
              onFiltersChange({ ...filters, maxPaise: amountToPaise(event.target.value) })
            }
          />
        </div>
        <p className="text-2xs text-content-subtle">
          Amounts are compared as exact integer paise, so a range of 100–100 never matches ₹99.999.
        </p>
      </div>
    </div>
  );
}

