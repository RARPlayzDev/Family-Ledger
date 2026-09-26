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

/** Sticky top bar: household context, quick add, account menu. */
export function TopBar() {
  const { displayName, email, profile, signOut } = useSession();
  const { hasHousehold } = useHousehold();
  const composer = useExpenseComposer();

  return (
    <header className="sticky top-0 z-30 border-t-0 border-b border-line bg-canvas/95 backdrop-blur pt-[env(safe-area-inset-top)]">
      <div className="flex min-h-[56px] items-center gap-3 px-4 lg:px-8">
        <Link to="/app" className="flex items-center gap-2 lg:hidden">
          <span className="flex size-8 items-center justify-center rounded-md bg-accent-soft text-accent">
            <Wallet className="size-4" />
          </span>
          <span className="text-sm font-semibold text-content">FamilyLedger</span>
        </Link>

        <div className="hidden lg:block">
          <HouseholdSwitcher />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="lg:hidden">
            <HouseholdSwitcher />
          </div>

          {hasHousehold ? (
            <>
              <Button
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => composer.openCreate()}
              >
                <Plus />
                Add expense
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="sm:hidden"
                aria-label="Add expense"
                onClick={() => composer.openCreate()}
              >
                <Plus />
              </Button>
            </>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="rounded-full transition-opacity hover:opacity-90"
              >
                <Avatar
                  name={displayName}
                  src={profile?.avatar_url ?? null}
                  size="md"
                  className="hidden lg:flex"
                />
                <span className="lg:hidden">
                  <span className="flex size-9 items-center justify-center rounded-full border border-line bg-surface-raised text-xs font-semibold text-content">
                    {initialsFromName(displayName)}
                  </span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Signed in</DropdownMenuLabel>
              <div className="px-2 pb-2">
                <p className="truncate text-sm text-content">{displayName}</p>
                <p className="truncate text-2xs text-content-subtle">{email ?? ''}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/app/settings">
                  <Settings />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem tone="danger" onSelect={() => void signOut()}>
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
