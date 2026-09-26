import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import { listHouseholdMembers, listMemberships } from '@/services/households.service';
import { useSession } from '@/hooks/use-session';
import type { HouseholdMember, HouseholdMembership } from '@/types/domain';
import type { HouseholdRole } from '@/types/database';

/**
 * Household context.
 *
 * One account can belong to several households (the schema is multi-household
 * ready), so the app tracks an "active" household. It is remembered per user in
 * localStorage, keeping the shared ledger stable across reloads without ever
 * caching ledger data itself.
 *
 * All ledger queries hang off `householdId`, so switching household naturally
 * re-scopes every screen: the household IS the shared ledger.
 */

const ACTIVE_HOUSEHOLD_PREFIX = 'familyledger:active-household:';

function readStoredHouseholdId(userId: string): string | null {
  try {
    return window.localStorage.getItem(`${ACTIVE_HOUSEHOLD_PREFIX}${userId}`);
  } catch {
    return null;
  }
}

function storeHouseholdId(userId: string, householdId: string): void {
  try {
    window.localStorage.setItem(`${ACTIVE_HOUSEHOLD_PREFIX}${userId}`, householdId);
  } catch {
    // Storage being unavailable (private mode) must never break the app.
  }
}

export type HouseholdContextValue = {
  isLoading: boolean;
  error: string | null;
  memberships: HouseholdMembership[];
  activeMembership: HouseholdMembership | null;
  householdId: string | null;
  householdName: string | null;
  timezone: string;
  role: HouseholdRole | null;
  isOwner: boolean;
  hasHousehold: boolean;
  members: HouseholdMember[];
  membersLoading: boolean;
  memberName: (userId: string) => string;
  setActiveHouseholdId: (householdId: string) => void;
  refresh: () => Promise<void>;
};

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { userId, status } = useSession();
  const [activeId, setActiveId] = useState<string | null>(null);
  const canQuery = status === 'authenticated' && Boolean(userId);

  const membershipsQuery = useQuery({
    queryKey: queryKeys.memberships(userId ?? 'anonymous'),
    queryFn: () => listMemberships(userId as string),
    enabled: canQuery,
    staleTime: 60_000,
  });

  const memberships = useMemo(() => membershipsQuery.data ?? [], [membershipsQuery.data]);

  // Restore the remembered household for this user.
  useEffect(() => {
    if (!userId) {
      setActiveId(null);
      return;
    }
    setActiveId(readStoredHouseholdId(userId));
  }, [userId]);

  // Fall back to the first household the account belongs to.
  useEffect(() => {
    if (memberships.length === 0) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    const stillMember = memberships.some((membership) => membership.household.id === activeId);
    if (!stillMember) {
      const fallback = memberships[0].household.id;
      setActiveId(fallback);
      if (userId) storeHouseholdId(userId, fallback);
    }
  }, [memberships, activeId, userId]);

  const activeMembership = useMemo(
    () => memberships.find((membership) => membership.household.id === activeId) ?? null,
    [memberships, activeId],
  );

  const householdId = activeMembership?.household.id ?? null;

  const membersQuery = useQuery({
    queryKey: queryKeys.householdMembers(householdId ?? 'none'),
    queryFn: () => listHouseholdMembers(householdId as string),
    enabled: Boolean(householdId),
    staleTime: 60_000,
  });

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);

  const memberIndex = useMemo(() => {
    const index = new Map<string, string>();
    for (const member of members) {
      index.set(member.user_id, member.profile?.display_name ?? 'Member');
    }
    return index;
  }, [members]);

  const setActiveHouseholdId = useCallback(
    (nextId: string) => {
      setActiveId(nextId);
      if (userId) storeHouseholdId(userId, nextId);
    },
    [userId],
  );

  const refresh = useCallback(async () => {
    await membershipsQuery.refetch();
    if (householdId) await membersQuery.refetch();
  }, [membershipsQuery, membersQuery, householdId]);

  const value = useMemo<HouseholdContextValue>(
    () => ({
      isLoading: membershipsQuery.isLoading,
      error: membershipsQuery.error ? 'Could not load your household.' : null,
      memberships,
      activeMembership,
      householdId,
      householdName: activeMembership?.household.name ?? null,
      timezone: activeMembership?.household.timezone ?? 'Asia/Kolkata',
      role: activeMembership?.role ?? null,
      isOwner: activeMembership?.role === 'owner',
      hasHousehold: memberships.length > 0,
      members,
      membersLoading: membersQuery.isLoading,
      memberName: (memberUserId: string) => memberIndex.get(memberUserId) ?? 'Member',
      setActiveHouseholdId,
      refresh,
    }),
    [
      membershipsQuery.isLoading,
      membershipsQuery.error,
      memberships,
      activeMembership,
      householdId,
      members,
      membersQuery.isLoading,
      memberIndex,
      setActiveHouseholdId,
      refresh,
    ],
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold(): HouseholdContextValue {
  const context = useContext(HouseholdContext);
  if (!context) {
    throw new Error('useHousehold must be used inside <HouseholdProvider>');
  }
  return context;
}
