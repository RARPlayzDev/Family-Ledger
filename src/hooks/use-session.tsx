import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import { onSessionTokenChange } from '@/lib/supabase';
import {
  resolveStoredSession,
  signOut as signOutRequest,
  type AppSession,
} from '@/services/auth.service';
import { getProfile } from '@/services/households.service';
import type { ProfileRow } from '@/types/database';

/**
 * Session + profile context (custom auth).
 *
 * The session token is owned by lib/supabase.ts; this provider resolves it
 * against the `resolve_session` RPC on boot, re-resolves whenever the token
 * changes (sign-in/sign-out), and loads the matching profile row. No component
 * reads storage directly.
 */

export type SessionStatus = 'loading' | 'unauthenticated' | 'authenticated';

export type SessionContextValue = {
  status: SessionStatus;
  session: AppSession | null;
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
  const [session, setSession] = useState<AppSession | null>(null);
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? null;
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const resolve = async () => {
      try {
        const current = await resolveStoredSession();
        if (!active) return;
        // A different account (or sign-out) must not see the previous cache.
        const nextUserId = current?.user.id ?? null;
        if (nextUserId !== previousUserIdRef.current) {
          queryClient.clear();
          previousUserIdRef.current = nextUserId;
        }
        setSession(current);
        setStatus(current ? 'authenticated' : 'unauthenticated');
      } catch {
        if (!active) return;
        setSession(null);
        setStatus('unauthenticated');
      }
    };

    // 1. Resolve the persisted session once on boot.
    void resolve();

    // 2. Re-resolve whenever the token changes (sign-in, sign-out). Status
    //    flips to 'loading' first so route guards show the loading screen
    //    instead of bouncing between /auth and /app mid-transition.
    const unsubscribe = onSessionTokenChange(() => {
      setStatus('loading');
      void resolve();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [queryClient]);

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
      email: session?.user.email ?? null,
      profile: profileQuery.data ?? null,
      profileLoading: profileQuery.isLoading,
      displayName:
        profileQuery.data?.display_name ??
        session?.user.display_name ??
        'Member',
      profileError: profileQuery.error ? 'Could not load your profile.' : null,
      refreshProfile,
      signOut,
    }),
    [
      status,
      session,
      userId,
      profileQuery.data,
      profileQuery.isLoading,
      profileQuery.error,
      refreshProfile,
      signOut,
    ],
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
