import { Link } from 'react-router-dom';
import { LogOut, Plus, Settings, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HouseholdSwitcher } from '@/components/layout/HouseholdSwitcher';
import { useSession } from '@/hooks/use-session';
import { useHousehold } from '@/hooks/use-household';
import { useExpenseComposer } from '@/features/expenses/use-expense-composer';
import { initialsFromName } from '@/services/auth.service';

/**
 * Sticky top bar: household context, quick-add expense, account menu.
 *
 * Glass surface that sits above the content on scroll, with 44px touch targets
 * and a truncating household name so actions never get pushed off the edge.
 */
export function TopBar() {
  const { displayName, email, profile, signOut } = useSession();
  const { hasHousehold } = useHousehold();
  const composer = useExpenseComposer();

  return (
    <header
      className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/60"
      aria-label="Primary"
    >
      <div className="flex min-h-[56px] items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-8">
        <Link
          to="/app"
          className="flex shrink-0 items-center gap-2.5 lg:hidden"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-ink shadow-soft">
            <Wallet className="size-4" />
          </span>
          <span className="hidden sm:inline text-sm font-semibold tracking-tight text-content">
            FamilyLedger
          </span>
        </Link>

        <div className="hidden lg:block">
          <HouseholdSwitcher />
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <div className="min-w-0 lg:hidden">
            <HouseholdSwitcher />
          </div>

          {hasHousehold ? (
            <>
              <Button
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => composer.openCreate()}
              >
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">Add expense</span>
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                className="sm:hidden"
                aria-label="Add expense"
                onClick={() => composer.openCreate()}
              >
                <Plus className="size-3.5" />
              </Button>
            </>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="flex min-touch shrink-0 items-center justify-center rounded-full p-1 transition-opacity hover:opacity-90 active:opacity-80"
              >
                <Avatar
                  name={displayName}
                  src={profile?.avatar_url ?? null}
                  size="md"
                  className="hidden lg:flex"
                />
                <span className="lg:hidden flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface-raised text-xs font-semibold text-content">
                  {initialsFromName(displayName)}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 popover">
              <DropdownMenuLabel className="text-content-muted">Account</DropdownMenuLabel>
              <div className="px-3 pb-2">
                <p className="truncate text-sm text-content">{displayName}</p>
                <p className="truncate text-[10px] text-content-subtle">{email ?? ''}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/app/settings">
                  <Settings className="size-3.5 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem tone="danger" onSelect={() => void signOut()}>
                <LogOut className="size-3.5 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
