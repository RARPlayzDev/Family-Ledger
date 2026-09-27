import { NavLink } from 'react-router-dom';
import { MOBILE_NAV } from '@/components/layout/nav-items';
import { cn } from '@/lib/utils';

/**
 * Mobile bottom navigation.
 * Respects the Android gesture bar through the safe-area inset and keeps every
 * destination at least 44px tall.
 */
export function MobileNav() {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur',
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
                  'flex min-touch select-none flex-col items-center justify-center gap-1 px-1 py-2 text-2xs transition-colors active:bg-surface-hover',
                  isActive ? 'text-accent' : 'text-content-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex size-8 items-center justify-center rounded-md transition-colors [&_svg]:size-4',
                      isActive && 'bg-accent-soft',
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
