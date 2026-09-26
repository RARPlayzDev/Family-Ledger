import { NavLink } from 'react-router-dom';
import { LogOut, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from '@/components/layout/nav-items';
import { useSession } from '@/hooks/use-session';
import { useHousehold } from '@/hooks/use-household';

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return cn(
    'flex min-touch items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent-soft text-accent'
      : 'text-content-muted hover:bg-surface-raised hover:text-content',
  );
}

function NavSection({
  items,
  label,
  onNavigate,
}: {
  items: NavItem[];
  label: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-1">
      <p className="px-3 pb-1 label-caps">{label}</p>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={navLinkClass}
        >
          <item.icon className="size-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}

/** Desktop sidebar. Hidden below `lg` in favour of the bottom navigation. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { displayName, email, profile, signOut } = useSession();
  const { householdName, role, isOwner } = useHousehold();

  return (
    <div className="flex h-full w-64 flex-col border-r border-line bg-surface/60">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="flex size-8 items-center justify-center rounded-md bg-accent-soft text-accent">
          <Wallet className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-content">FamilyLedger</p>
          <p className="truncate text-2xs text-content-subtle">
            {householdName ?? 'No household yet'}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 pb-4">
        <NavSection items={PRIMARY_NAV} label="Ledger" onNavigate={onNavigate} />
        <NavSection items={SECONDARY_NAV} label="Account" onNavigate={onNavigate} />
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2">
          <Avatar name={displayName} src={profile?.avatar_url ?? null} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-content">{displayName}</p>
            <p className="truncate text-2xs text-content-subtle">{email ?? 'Signed in'}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          {role ? (
            <Badge tone={isOwner ? 'accent' : 'neutral'}>{isOwner ? 'Owner' : 'Member'}</Badge>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex min-touch items-center gap-1.5 rounded-md px-2 text-2xs font-medium text-content-muted transition-colors hover:bg-surface-raised hover:text-content"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
