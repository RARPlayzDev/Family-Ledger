import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import {
  getCurrentSession,
  onAuthStateChange,
  signOut as signOutRequest,
} from '@/services/auth.service';
import { getProfile } from '@/services/households.service';
import type { ProfileRow } from '@/types/database';

/**
 * Session + profile context.
 *
 * The session itself is owned by supabase-js (see lib/supabase.ts); this provider
 * mirrors it into React state and loads the matching profile row, so no component
 * reads auth storage directly.
 */

export type SessionStatus = 'loading' | 'unauthenticated' | 'authenticated';

export type SessionContextValue = {
  status: SessionStatus;
  session: Session | null;
  userId: string | null;
  email: string | null;
  profile: ProfileRow | null;
  profileLoading: boolean;
  displayName: string;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const queryClient = useQueryClient();
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    let active = true;

    // 1. Resolve the persisted session once (handles PKCE callbacks too).
    getCurrentSession()
      .then((current) => {
        if (!active) return;
        setSession(current);
        setStatus(current ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setStatus('unauthenticated');
      });

    // 2. Follow every later auth event (sign in, refresh, sign out, recovery).
    const unsubscribe = onAuthStateChange((next) => {
      if (!active) return;
      setSession(next);
      setStatus(next ? 'authenticated' : 'unauthenticated');
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(userId ?? 'anonymous'),
    queryFn: () => getProfile(userId as string),
    enabled: status === 'authenticated' && Boolean(userId),
    staleTime: 5 * 60_000,
  });

  const refreshProfile = useCallback(async () => {
    await profileQuery.refetch();
  }, [profileQuery]);

  const signOut = useCallback(async () => {
    await signOutRequest();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      session,
      userId,
      email: session?.user?.email ?? null,
      profile: profileQuery.data ?? null,
      profileLoading: profileQuery.isLoading,
      displayName:
        profileQuery.data?.display_name ??
        session?.user?.email?.split('@')[0] ??
        'Member',
      profileError: profileQuery.error ? 'Could not load your profile.' : null,
      refreshProfile,
      signOut,
    }),
    [status, session, userId, profileQuery.data, profileQuery.isLoading, profileQuery.error, refreshProfile, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return context;
}
