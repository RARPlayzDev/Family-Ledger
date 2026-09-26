import { getSupabase } from '@/lib/supabase';

/** Membership mutations. Authorization lives in RLS (owner-only rules). */

/** Owner removes somebody else from the household. */
export async function removeHouseholdMember(
  householdId: string,
  memberUserId: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from('household_members')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', memberUserId);
  if (error) throw error;
}

/**
 * A member removes themselves. The `household_members_delete_owner_or_self`
 * policy allows this only for role = 'member'; an owner must hand the household
 * over first, which the `guard_household_member` trigger also enforces.
 */
export async function leaveHousehold(householdId: string, memberUserId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('household_members')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', memberUserId);
  if (error) throw error;
}

/** Owner adds an account that already exists, without an invitation. */
export async function addExistingMember(
  householdId: string,
  memberUserId: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from('household_members')
    .insert({ household_id: householdId, user_id: memberUserId, role: 'member' });
  if (error) throw error;
}
