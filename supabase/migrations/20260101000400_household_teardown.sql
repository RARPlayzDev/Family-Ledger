-- =============================================================================
-- FamilyLedger :: 0004 household teardown (delete_household)
-- -----------------------------------------------------------------------------
-- WHY THIS FILE EXISTS
--
-- Until now a household could be created but never deleted - not from the app,
-- not even from the SQL editor:
--
--   * 0003 moved every write off RLS and replaced it with SECURITY DEFINER
--     RPCs, dropping `households_delete_owner` along with the other write
--     policies. No delete RPC was ever written, so no client path exists.
--   * `guard_household_member()` (000100) raises check_violation the moment the
--     owner's own membership row is deleted. That is exactly what the
--     `ON DELETE CASCADE` from `households` -> `household_members` does, and it
--     is also what the dashboard's Table Editor does when you delete a row:
--
--       DELETE FROM ONLY "public"."household_members" WHERE household_id = $1
--       ERROR: 23514: The household owner must transfer ownership before leaving
--
--     The rule is correct for "leave household" and wrong for "delete
--     household", so it stays for every client path and gains exactly one
--     deliberate exception.
--
-- DESIGN
--   * The exception is a transaction-local GUC holding the id of the ONE
--     household being torn down. delete_household() sets it, deletes, and
--     clears it, all inside a single transaction. Any other delete (leaving,
--     removing a member, a manual dashboard delete, a stray cascade) still
--     hits the guard unchanged.
--   * The flag cannot be reached from the API: no client role holds DELETE on
--     any table (see 0003) and PostgREST exposes no way to set a custom GUC, so
--     a caller can never satisfy the guard's bypass itself.
--   * Child rows are removed in foreign-key order rather than relying on
--     cascade order, because `expenses(household_id, spent_by)` references
--     `household_members` with ON DELETE RESTRICT: if the memberships went
--     first, the teardown would be blocked by the members' own expenses.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- household_members guard, now teardown-aware
-- ---------------------------------------------------------------------------
create or replace function public.guard_household_member()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
begin
  if tg_op = 'DELETE' then
    -- Household teardown: delete_household() is removing every membership row
    -- of one household on purpose, the owner's included. Nothing else sets
    -- this flag, and it is transaction-local, so the rule below still applies
    -- to leaving, member removal and manual deletes.
    if current_setting('familyledger.purging_household', true) = old.household_id::text then
      return old;
    end if;

    select h.owner_id into v_owner from public.households h where h.id = old.household_id;
    if old.role = 'owner' or v_owner = old.user_id then
      raise exception 'The household owner must transfer ownership before leaving'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  select h.owner_id into v_owner from public.households h where h.id = new.household_id;
  if v_owner is null then
    raise exception 'Unknown household %', new.household_id
      using errcode = 'foreign_key_violation';
  end if;

  if new.role = 'owner' and new.user_id <> v_owner then
    raise exception 'Only the household owner can hold the owner role'
      using errcode = 'check_violation';
  end if;

  if new.role <> 'owner' and new.user_id = v_owner then
    raise exception 'The household owner cannot be demoted; transfer ownership instead'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_household : owner-only, permanent, all-or-nothing
--
-- Removes the household and every row scoped to it. Accounts survive - only
-- their membership in this ledger disappears, so each member lands back on
-- onboarding with their own profile intact.
-- ---------------------------------------------------------------------------
create or replace function public.delete_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid;
begin
  v_uid := public._require_session();

  if not public._owner_of(p_household_id, v_uid) then
    raise exception 'Only the household owner can delete this household.'
      using errcode = 'insufficient_privilege';
  end if;

  -- 1. The ledger itself. `expenses` must go before the membership rows: the
  --    composite FK expenses(household_id, spent_by) -> household_members is
  --    ON DELETE RESTRICT, so it would otherwise block step 3.
  delete from public.expenses e where e.household_id = p_household_id;

  -- 2. Spending limits (rows reference household categories).
  delete from public.budgets b where b.household_id = p_household_id;

  -- 3. Memberships. The guard is told, for this transaction only, that this
  --    one household is being purged - see the flag's comment at the top.
  perform set_config('familyledger.purging_household', p_household_id::text, true);
  delete from public.household_members m where m.household_id = p_household_id;
  perform set_config('familyledger.purging_household', '', true);

  -- 4. Only THIS household's custom categories. System defaults are shared and
  --    carry household_id IS NULL, so they are untouched.
  delete from public.categories c where c.household_id = p_household_id;

  -- 5. Finally the household row. Every child row is already gone, so no
  --    cascade action can fire and no guard can be reached.
  delete from public.households h where h.id = p_household_id;
end;
$$;

revoke all on function public.delete_household(uuid) from public;
grant execute on function public.delete_household(uuid) to anon, authenticated;
