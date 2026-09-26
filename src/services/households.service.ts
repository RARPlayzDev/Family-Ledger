import { getSupabase } from '@/lib/supabase';
import type { HouseholdMembership, HouseholdMember, MemberSummary } from '@/types/domain';
import type { HouseholdRole, ProfileRow } from '@/types/database';

/** Reads and writes of the account profile and its household memberships. */

const PROFILE_SELECT = 'id, display_name, avatar_url, created_at, updated_at';

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
  const { data, error } = await getSupabase()
    .from('profiles')
    .update(changes)
    .eq('id', userId)
    .select(PROFILE_SELECT)
    .single();
  if (error) throw error;
  return data;
}

/** Every household the signed-in account belongs to, with the household row. */
export async function listMemberships(userId: string): Promise<HouseholdMembership[]> {
  const { data, error } = await getSupabase()
    .from('household_members')
    .select(
      'role, joined_at, household:households!household_members_household_id_fkey(id, name, owner_id, currency_code, timezone, created_at, updated_at)',
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
  const { data, error } = await getSupabase()
    .from('households')
    .insert({
      name: input.name.trim(),
      owner_id: input.ownerId,
      timezone: input.timezone,
    })
    .select('id, name, owner_id, currency_code, timezone, created_at, updated_at')
    .single();
  if (error) throw error;

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
  const { error } = await getSupabase().from('households').update(changes).eq('id', householdId);
  if (error) throw error;
}

/**
 * Transfers ownership to an existing member.
 * The database rejects the change unless the target already belongs to the
 * household (see `assert_owner_is_member`), so the UI cannot escalate privileges.
 */
export async function transferOwnership(householdId: string, newOwnerId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('households')
    .update({ owner_id: newOwnerId })
    .eq('id', householdId);
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
