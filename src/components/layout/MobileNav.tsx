import { NavLink } from 'react-router-dom';
import { MOBILE_NAV } from '@/components/layout/nav-items';
import { cn } from '@/lib/utils';

/**
 * Mobile bottom navigation.
 * Respects the Android gesture bar through the safe-area inset and keeps every
 * destination at least 44px tall. Glass surface with a subtle active state.
 */
export function MobileNav() {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/80 backdrop-blur-md supports-[backdrop-filter]:bg-surface/60',
        'pb-[env(safe-area-inset-bottom)] lg:hidden',
      )}
    >
      <ul className="grid grid-cols-5">
        {MOBILE_NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              aria-label={item.label}
              className={({ isActive }) =>
                cn(
                  'flex min-touch select-none flex-col items-center justify-center gap-1.5 px-1 py-2.5 text-[10px] transition-colors active:bg-surface-active',
                  isActive ? 'text-accent' : 'text-content-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors [&_svg]:size-4.5',
                      isActive && 'bg-accent-soft text-accent shadow-soft',
                    )}
                  >
                    <item.icon />
                  </span>
                  <span className="font-medium">{item.shortLabel}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
