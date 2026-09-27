import { getSupabase } from '@/lib/supabase';
import type { HouseholdMembership, HouseholdMember, MemberSummary } from '@/types/domain';
import type { HouseholdRole, ProfileRow } from '@/types/database';

/** Reads and writes of the account profile and its household memberships. */

const PROFILE_SELECT = 'id, email, username, display_name, avatar_url, created_at, updated_at';

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  userId: string,
  changes: { display_name?: string; avatar_url?: string | null },
): Promise<ProfileRow> {
  // The edited account is always the session's own account, server-side.
  void userId;
  const { error } = await getSupabase().rpc('update_my_profile', {
    p_display_name: changes.display_name ?? null,
    p_avatar_url: changes.avatar_url ?? null,
  });
  if (error) throw error;

  const { data, error: readError } = await getSupabase()
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .single();
  if (readError) throw readError;
  return data;
}

/** Every household the signed-in account belongs to, with the household row. */
export async function listMemberships(userId: string): Promise<HouseholdMembership[]> {
  const { data, error } = await getSupabase()
    .from('household_members')
    .select(
      'role, joined_at, household:households!household_members_household_id_fkey(id, name, owner_id, currency_code, timezone, join_code, created_at, updated_at)',
    )
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    .returns<HouseholdMembership[]>();
  if (error) throw error;
  return (data ?? []).filter((row) => row.household !== null);
}

/**
 * Creates the household for the signed-in account.
 * The `households_sync_owner_membership` trigger inserts the owner membership
 * row in the same transaction, so a household can never exist without an owner.
 */
export async function createHousehold(input: {
  name: string;
  ownerId: string;
  timezone?: string;
}): Promise<HouseholdMembership> {
  // The owner is derived from the session header server-side (ownerId is kept
  // in the signature only so callers can invalidate the right cache key).
  const { data: householdId, error } = await getSupabase().rpc('create_household', {
    p_name: input.name,
    p_timezone: input.timezone ?? null,
  });
  if (error) throw error;

  const { data, error: readError } = await getSupabase()
    .from('households')
    .select('id, name, owner_id, currency_code, timezone, join_code, created_at, updated_at')
    .eq('id', householdId)
    .single();
  if (readError) throw readError;

  return {
    household: data,
    role: 'owner',
    joined_at: data.created_at,
  };
}

export async function updateHousehold(
  householdId: string,
  changes: { name?: string; timezone?: string },
): Promise<void> {
  const { error } = await getSupabase().rpc('update_household', {
    p_household_id: householdId,
    p_name: changes.name ?? null,
    p_timezone: changes.timezone ?? null,
  });
  if (error) throw error;
}

/**
 * Transfers ownership to an existing member.
 * The database rejects the change unless the target already belongs to the
 * household (see `assert_owner_is_member`), so the UI cannot escalate privileges.
 */
export async function transferOwnership(householdId: string, newOwnerId: string): Promise<void> {
  const { error } = await getSupabase().rpc('transfer_household_ownership', {
    p_household_id: householdId,
    p_new_owner_id: newOwnerId,
  });
  if (error) throw error;
}

/**
 * Deletes the household and everything scoped to it: the shared ledger, the
 * budgets, the custom categories and every membership.
 *
 * Irreversible and owner-only (both enforced inside the RPC). Accounts are not
 * touched - each removed member lands back on onboarding with their profile
 * intact - which is why the RPC, and not a plain DELETE, owns this operation:
 * a raw delete of the owner's membership row is refused by the
 * `guard_household_member` trigger.
 */
export async function deleteHousehold(householdId: string): Promise<void> {
  const { error } = await getSupabase().rpc('delete_household', {
    p_household_id: householdId,
  });
  if (error) throw error;
}

/** Members of a household with their profile (RLS: only for co-members). */
export async function listHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  const { data, error } = await getSupabase()
    .from('household_members')
    .select(
      'user_id, role, joined_at, profile:profiles!household_members_user_id_fkey(id, display_name, avatar_url)',
    )
    .eq('household_id', householdId)
    .order('joined_at', { ascending: true })
    .returns<HouseholdMember[]>();
  if (error) throw error;
  return data ?? [];
}

export function memberSummaryOf(member: HouseholdMember): MemberSummary {
  return (
    member.profile ?? {
      id: member.user_id,
      display_name: 'Member',
      avatar_url: null,
    }
  );
}

export function roleLabel(role: HouseholdRole): string {
  return role === 'owner' ? 'Owner' : 'Member';
}
