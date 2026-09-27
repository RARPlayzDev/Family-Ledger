import { Check, ChevronDown, Home, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useHousehold } from '@/hooks/use-household';
import { cn } from '@/lib/utils';

/**
 * Household switcher.
 * The app is single-ledger per household; this control makes it explicit which
 * shared ledger every number on screen belongs to, and it is the entry point for
 * a second household later on.
 */
export function HouseholdSwitcher() {
  const { memberships, activeMembership, setActiveHouseholdId, householdName } = useHousehold();

  if (memberships.length === 0) {
    return (
      <span className="text-xs text-content-muted">No household</span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Shared ledger: ${householdName ?? 'Household'}`}
          className="flex min-touch min-w-0 max-w-[55vw] items-center gap-2 rounded-md border border-line bg-surface-raised px-2.5 text-left text-sm text-content transition-colors hover:border-line-strong active:bg-surface-hover sm:max-w-none"
        >
          <Home className="size-4 shrink-0 text-content-subtle" />
          <span className="truncate font-medium">{householdName ?? 'Household'}</span>
          {activeMembership?.role === 'owner' ? (
            <Badge tone="accent" className="hidden sm:inline-flex">
              Owner
            </Badge>
          ) : null}
          <ChevronDown className="size-3.5 shrink-0 text-content-subtle" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Shared ledger</DropdownMenuLabel>
        {memberships.map((membership) => {
          const isActive = membership.household.id === activeMembership?.household.id;
          return (
            <DropdownMenuItem
              key={membership.household.id}
              onSelect={() => setActiveHouseholdId(membership.household.id)}
              className={cn(isActive && 'text-accent')}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <Users className="size-3.5 shrink-0 text-content-subtle" />
                <span className="truncate">{membership.household.name}</span>
              </span>
              {isActive ? <Check className="size-3.5" /> : null}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-2xs text-content-subtle">
          Every member of a household shares one ledger.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
