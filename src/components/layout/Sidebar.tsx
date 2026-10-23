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
    'flex min-touch items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-surface-raised text-accent shadow-soft'
      : 'text-content-muted hover:bg-surface-hover hover:text-content',
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
    <div className="flex h-full w-64 flex-col border-r border-line bg-surface/70 backdrop-blur-sm">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-soft">
          <Wallet className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-content">
            FamilyLedger
          </p>
          <p className="truncate text-[10px] text-content-subtle">
            {householdName ?? 'No household yet'}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
        <NavSection items={PRIMARY_NAV} label="Ledger" onNavigate={onNavigate} />
        <NavSection items={SECONDARY_NAV} label="Account" onNavigate={onNavigate} />
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={displayName} src={profile?.avatar_url ?? null} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-content">
              {displayName}
            </p>
            <p className="truncate text-[10px] text-content-subtle">
              {email ?? 'Signed in'}
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          {role ? (
            <Badge tone={isOwner ? 'accent' : 'neutral'}>{isOwner ? 'Owner' : 'Member'}</Badge>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex min-touch items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
