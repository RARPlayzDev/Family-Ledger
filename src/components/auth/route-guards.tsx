import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppLoadingScreen } from '@/components/system/system-screens';
import { useSession } from '@/hooks/use-session';
import { useHousehold } from '@/hooks/use-household';

/** Requires a signed-in session; remembers where the user was heading. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const location = useLocation();

  if (status === 'loading') return <AppLoadingScreen />;
  if (status === 'unauthenticated') {
    return <Navigate to="/auth" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <>{children}</>;
}

/**
 * Requires an active household.
 *
 * The whole app is scoped to a household, so an account that has not created or
 * joined one is sent to onboarding instead of rendering empty dashboards.
 */
export function RequireHousehold({ children }: { children: ReactNode }) {
  const { isLoading, hasHousehold, error } = useHousehold();
  const location = useLocation();

  if (isLoading) return <AppLoadingScreen label="Loading your household…" />;
  if (error) return <AppLoadingScreen label="Retrying your household…" />;
  if (!hasHousehold) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
