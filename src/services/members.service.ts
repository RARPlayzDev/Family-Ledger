import { getSupabase } from '@/lib/supabase';

/** Membership mutations. Authorization is enforced inside the write RPCs. */

/** Owner removes somebody else from the household. */
export async function removeHouseholdMember(
  householdId: string,
  memberUserId: string,
): Promise<void> {
  const { error } = await getSupabase().rpc('remove_household_member', {
    p_household_id: householdId,
    p_user_id: memberUserId,
  });
  if (error) throw error;
}

/**
 * A member removes themselves. The RPC refuses to drop the owner, so ownership
 * must be transferred first (the `guard_household_member` trigger enforces the
 * same rule at the storage layer).
 */
export async function leaveHousehold(householdId: string, memberUserId: string): Promise<void> {
  const { error } = await getSupabase().rpc('remove_household_member', {
    p_household_id: householdId,
    p_user_id: memberUserId,
  });
  if (error) throw error;
}

/** Owner adds an account that already exists, without an invitation. */
export async function addExistingMember(
  householdId: string,
  memberUserId: string,
): Promise<void> {
  const { error } = await getSupabase().rpc('add_household_member', {
    p_household_id: householdId,
    p_user_id: memberUserId,
  });
  if (error) throw error;
}

/**
 * Joins a household through its shareable join code (join_by_code RPC).
 * Knowing the code IS the authorization; the acting account comes from the
 * session header on the server.
 */
export async function joinHouseholdByCode(
  code: string,
): Promise<{ household_id: string; name: string }> {
  const { data, error } = await getSupabase().rpc('join_by_code', { p_code: code });
  if (error) throw error;
  if (!data) throw new Error('That join code is not valid.');
  return data;
}
