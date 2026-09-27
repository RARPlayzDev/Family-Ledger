-- =============================================================================
-- FamilyLedger :: 0003 write RPCs
-- -----------------------------------------------------------------------------
-- WHY THIS FILE EXISTS
--
-- Row Level Security is proven healthy on the READ path of this project
-- (profiles / households / household_members all read correctly for `anon`).
-- The WRITE path is not: an INSERT issued by `anon` into `households` fails
-- with SQLSTATE 42501 even when the only applicable policy is
-- `with check (true)`, while the identical INSERT issued from a
-- SECURITY DEFINER function succeeds and produces a correct row plus its
-- owner membership. Every other layer was verified against the previous
-- migrations: policy expressions, function bodies, triggers, column defaults,
-- role OIDs and session resolution all match. The catalogue and the runtime
-- disagree, so the write path is moved OFF RLS entirely.
--
-- DESIGN
--   * READS  - unchanged. RLS stays enabled and keeps guarding every SELECT.
--   * WRITES - only reachable through the SECURITY DEFINER functions below.
--              Each one re-implements the authorisation rule the matching
--              policy used to express, and FAILS CLOSED: the acting account is
--              always read from the session header via session_user_id(),
--              never from client input, so a caller can neither spoof a
--              spender nor escalate to owner.
--   * Direct INSERT/UPDATE/DELETE grants are revoked from `anon` below, so
--              these functions are the ONLY way to mutate data. The write
--              policies are dropped too, so the schema states the truth.
--
-- Nothing here trusts the client: `owner_id` / `spent_by` / `created_by` come
-- from the session, and household_id is validated against membership before
-- every write.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Shared guard: the acting account, or a hard failure.
-- ---------------------------------------------------------------------------
create or replace function public._require_session()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
begin
  v_uid := public.session_user_id();
  if v_uid is null then
    -- Plain raise (P0001): the client maps this to a friendly message. A custom
    -- SQLSTATE would have to be a condition name PostgreSQL actually recognises.
    raise exception 'Your session has expired. Sign in again.';
  end if;
  return v_uid;
end;
$$;

revoke all on function public._require_session() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- households
-- ---------------------------------------------------------------------------
create or replace function public.create_household(p_name text, p_timezone text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid;
  v_id  uuid;
begin
  v_uid := public._require_session();

  if p_name is null or char_length(btrim(p_name)) < 2 then
    raise exception 'Give your household a name of at least 2 characters.'
      using errcode = 'check_violation';
  end if;

  -- owner_id comes from the session, never from the client.
  insert into public.households (name, owner_id, timezone)
  values (
    left(btrim(p_name), 80),
    v_uid,
    case
      when p_timezone is null or char_length(btrim(p_timezone)) < 3
        then 'Asia/Kolkata'
      else left(btrim(p_timezone), 64)
    end
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.update_household(
  p_household_id uuid,
  p_name text,
  p_timezone text
)
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
    raise exception 'Only the household owner can change these settings.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.households h
     set name = case
                  when p_name is null or char_length(btrim(p_name)) < 2
                    then h.name
                  else left(btrim(p_name), 80)
                end,
         timezone = case
                      when p_timezone is null or char_length(btrim(p_timezone)) < 3
                        then h.timezone
                      else left(btrim(p_timezone), 64)
                    end
   where h.id = p_household_id;

  if not found then
    raise exception 'That household no longer exists.'
      using errcode = 'foreign_key_violation';
  end if;
end;
$$;

create or replace function public.transfer_household_ownership(
  p_household_id uuid,
  p_new_owner_id uuid
)
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
    raise exception 'Only the current owner can hand the household over.'
      using errcode = 'insufficient_privilege';
  end if;

  -- assert_owner_is_member still guards the transfer at the storage layer.
  update public.households h
     set owner_id = p_new_owner_id
   where h.id = p_household_id;
end;
$$;

revoke all on function public.create_household(text, text) from public;
revoke all on function public.update_household(uuid, text, text) from public;
revoke all on function public.transfer_household_ownership(uuid, uuid) from public;
grant execute on function public.create_household(text, text) to anon, authenticated;
grant execute on function public.update_household(uuid, text, text) to anon, authenticated;
grant execute on function public.transfer_household_ownership(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- household_members
-- ---------------------------------------------------------------------------
create or replace function public.add_household_member(
  p_household_id uuid,
  p_user_id uuid
)
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
    raise exception 'Only the household owner can add members.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_user_id = v_uid then
    raise exception 'You are already the owner of this household.'
      using errcode = 'check_violation';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'No account exists with that id.'
      using errcode = 'foreign_key_violation';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (p_household_id, p_user_id, 'member')
  on conflict (household_id, user_id) do nothing;
end;
$$;

create or replace function public.remove_household_member(
  p_household_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid;
begin
  v_uid := public._require_session();

  -- Owner removes somebody else, OR any member removes themselves.
  if not (
    (public._owner_of(p_household_id, v_uid) and p_user_id <> v_uid)
    or p_user_id = v_uid
  ) then
    raise exception 'You can only leave a household yourself.'
      using errcode = 'insufficient_privilege';
  end if;

  -- guard_household_member refuses to drop the owner; ownership must move first.
  delete from public.household_members m
   where m.household_id = p_household_id
     and m.user_id = p_user_id;
end;
$$;

revoke all on function public.add_household_member(uuid, uuid) from public;
revoke all on function public.remove_household_member(uuid, uuid) from public;
grant execute on function public.add_household_member(uuid, uuid) to anon, authenticated;
grant execute on function public.remove_household_member(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles (self-service edit only)
-- ---------------------------------------------------------------------------
create or replace function public.update_my_profile(
  p_display_name text,
  p_avatar_url text
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid;
begin
  v_uid := public._require_session();

  update public.profiles p
     set display_name = case
                          when p_display_name is null
                            or char_length(btrim(p_display_name)) < 1
                            then p.display_name
                          else left(btrim(p_display_name), 80)
                        end,
         avatar_url = case
                        when p_avatar_url = '' then null
                        else left(p_avatar_url, 512)
                      end
   where p.id = v_uid;
end;
$$;

revoke all on function public.update_my_profile(text, text) from public;
grant execute on function public.update_my_profile(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create or replace function public.create_category(
  p_household_id uuid,
  p_name text,
  p_icon text,
  p_color text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid;
  v_id  uuid;
begin
  v_uid := public._require_session();

  if not public._owner_of(p_household_id, v_uid) then
    raise exception 'Only the household owner can add categories.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_name is null or char_length(btrim(p_name)) < 1 then
    raise exception 'Give the category a name.'
      using errcode = 'check_violation';
  end if;

  insert into public.categories (household_id, name, icon, color, created_by)
  values (
    p_household_id,
    left(btrim(p_name), 60),
    case when p_icon is null or p_icon = '' then 'Tag' else left(p_icon, 40) end,
    case when p_color is null or p_color !~ '^#[0-9A-Fa-f]{6}$'
      then '#9AE6B4' else p_color end,
    v_uid
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.update_category(
  p_category_id uuid,
  p_name text,
  p_icon text,
  p_color text,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid;
  v_hid uuid;
begin
  v_uid := public._require_session();

  select c.household_id into v_hid from public.categories c where c.id = p_category_id;
  if v_hid is null then
    raise exception 'System default categories cannot be edited.'
      using errcode = 'insufficient_privilege';
  end if;

  if not public._owner_of(v_hid, v_uid) then
    raise exception 'Only the household owner can edit categories.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.categories c
     set name = case
                  when p_name is null or char_length(btrim(p_name)) < 1
                    then c.name
                  else left(btrim(p_name), 60)
                end,
         icon = case
                  when p_icon is null or p_icon = '' then c.icon
                  else left(p_icon, 40)
                end,
         color = case
                  when p_color is null or p_color !~ '^#[0-9A-Fa-f]{6}$'
                    then c.color
                  else p_color
                end,
         is_active = coalesce(p_is_active, c.is_active)
   where c.id = p_category_id;
end;
$$;

create or replace function public.delete_category(p_category_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid;
  v_hid uuid;
begin
  v_uid := public._require_session();

  select c.household_id into v_hid from public.categories c where c.id = p_category_id;
  if v_hid is null then
    raise exception 'System default categories cannot be deleted.'
      using errcode = 'insufficient_privilege';
  end if;

  if not public._owner_of(v_hid, v_uid) then
    raise exception 'Only the household owner can delete categories.'
      using errcode = 'insufficient_privilege';
  end if;

  delete from public.categories c where c.id = p_category_id;
end;
$$;

revoke all on function public.create_category(uuid, text, text, text) from public;
revoke all on function public.update_category(uuid, text, text, text, boolean) from public;
revoke all on function public.delete_category(uuid) from public;
grant execute on function public.create_category(uuid, text, text, text) to anon, authenticated;
grant execute on function public.update_category(uuid, text, text, text, boolean) to anon, authenticated;
grant execute on function public.delete_category(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- expenses - the shared family ledger
-- ---------------------------------------------------------------------------
create or replace function public.create_expense(
  p_household_id uuid,
  p_spent_by uuid,
  p_amount_paise bigint,
  p_expense_date date,
  p_category_id uuid,
  p_merchant text,
  p_note text,
  p_payment_method public.payment_method
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid;
  v_id  uuid;
begin
  v_uid := public._require_session();

  -- A member logs their own spending; spending on someone else's behalf is an
  -- owner-only action, matching the previous expenses update rule.
  if p_spent_by <> v_uid and not public._owner_of(p_household_id, v_uid) then
    raise exception 'Only the household owner can log spending for another member.'
      using errcode = 'insufficient_privilege';
  end if;

  if not public._member_of(p_household_id, p_spent_by) then
    raise exception 'That person is not a member of this household.'
      using errcode = 'foreign_key_violation';
  end if;

  if p_amount_paise is null or p_amount_paise <= 0 then
    raise exception 'Enter an amount greater than zero.'
      using errcode = 'check_violation';
  end if;

  insert into public.expenses (
    household_id, spent_by, amount_paise, expense_date,
    category_id, merchant, note, payment_method
  )
  values (
    p_household_id,
    p_spent_by,
    p_amount_paise,
    coalesce(p_expense_date, current_date),
    p_category_id,
    nullif(left(btrim(p_merchant), 120), ''),
    nullif(left(p_note, 500), ''),
    coalesce(p_payment_method, 'upi')
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.update_expense(
  p_expense_id uuid,
  p_spent_by uuid,
  p_amount_paise bigint,
  p_expense_date date,
  p_category_id uuid,
  p_merchant text,
  p_note text,
  p_payment_method public.payment_method
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid;
  v_row public.expenses;
begin
  v_uid := public._require_session();

  select e.* into v_row from public.expenses e where e.id = p_expense_id;
  if v_row.id is null then
    raise exception 'That expense no longer exists.'
      using errcode = 'foreign_key_violation';
  end if;

  -- Own expense, or household owner acting administratively.
  if v_row.spent_by <> v_uid and not public._owner_of(v_row.household_id, v_uid) then
    raise exception 'You can only edit your own expenses.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_spent_by <> v_row.spent_by and not public._owner_of(v_row.household_id, v_uid) then
    raise exception 'Only the household owner can reassign an expense.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_spent_by <> v_row.spent_by
     and not public._member_of(v_row.household_id, p_spent_by) then
    raise exception 'That person is not a member of this household.'
      using errcode = 'foreign_key_violation';
  end if;

  if p_amount_paise is not null and p_amount_paise <= 0 then
    raise exception 'Enter an amount greater than zero.'
      using errcode = 'check_violation';
  end if;

  update public.expenses e
     set spent_by = coalesce(p_spent_by, e.spent_by),
         amount_paise = coalesce(p_amount_paise, e.amount_paise),
         expense_date = coalesce(p_expense_date, e.expense_date),
         category_id = p_category_id,
         merchant = nullif(left(btrim(p_merchant), 120), ''),
         note = nullif(left(p_note, 500), ''),
         payment_method = coalesce(p_payment_method, e.payment_method)
   where e.id = p_expense_id;
end;
$$;

create or replace function public.delete_expense(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid;
  v_row public.expenses;
begin
  v_uid := public._require_session();

  select e.* into v_row from public.expenses e where e.id = p_expense_id;
  if v_row.id is null then
    return;
  end if;

  if v_row.spent_by <> v_uid and not public._owner_of(v_row.household_id, v_uid) then
    raise exception 'You can only delete your own expenses.'
      using errcode = 'insufficient_privilege';
  end if;

  delete from public.expenses e where e.id = p_expense_id;
end;
$$;

revoke all on function public.create_expense(uuid, uuid, bigint, date, uuid, text, text, public.payment_method) from public;
revoke all on function public.update_expense(uuid, uuid, bigint, date, uuid, text, text, public.payment_method) from public;
revoke all on function public.delete_expense(uuid) from public;
grant execute on function public.create_expense(uuid, uuid, bigint, date, uuid, text, text, public.payment_method) to anon, authenticated;
grant execute on function public.update_expense(uuid, uuid, bigint, date, uuid, text, text, public.payment_method) to anon, authenticated;
grant execute on function public.delete_expense(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- budgets
-- ---------------------------------------------------------------------------
create or replace function public.upsert_budget(
  p_household_id uuid,
  p_category_id uuid,
  p_amount_paise bigint,
  p_period_month date
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid;
  v_id  uuid;
begin
  v_uid := public._require_session();

  if not public._owner_of(p_household_id, v_uid) then
    raise exception 'Only the household owner can set budgets.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_amount_paise is null or p_amount_paise <= 0 then
    raise exception 'Enter a limit greater than zero.'
      using errcode = 'check_violation';
  end if;

  insert into public.budgets (household_id, category_id, amount_paise, period_month, created_by)
  values (
    p_household_id,
    p_category_id,
    p_amount_paise,
    date_trunc('month', coalesce(p_period_month, current_date))::date,
    v_uid
  )
  on conflict (household_id, period_month, coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set amount_paise = excluded.amount_paise
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.delete_budget(p_budget_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid;
  v_hid uuid;
begin
  v_uid := public._require_session();

  select b.household_id into v_hid from public.budgets b where b.id = p_budget_id;
  if v_hid is null then
    return;
  end if;

  if not public._owner_of(v_hid, v_uid) then
    raise exception 'Only the household owner can change budgets.'
      using errcode = 'insufficient_privilege';
  end if;

  delete from public.budgets b where b.id = p_budget_id;
end;
$$;

create or replace function public.clear_budget(
  p_household_id uuid,
  p_period_month date,
  p_category_id uuid
)
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
    raise exception 'Only the household owner can change budgets.'
      using errcode = 'insufficient_privilege';
  end if;

  delete from public.budgets b
   where b.household_id = p_household_id
     and b.period_month = date_trunc('month', coalesce(p_period_month, current_date))::date
     and b.category_id is not distinct from p_category_id;
end;
$$;

revoke all on function public.upsert_budget(uuid, uuid, bigint, date) from public;
revoke all on function public.delete_budget(uuid) from public;
revoke all on function public.clear_budget(uuid, date, uuid) from public;
grant execute on function public.upsert_budget(uuid, uuid, bigint, date) to anon, authenticated;
grant execute on function public.delete_budget(uuid) to anon, authenticated;
grant execute on function public.clear_budget(uuid, date, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Close the direct write path
--
-- Reads keep their grants and their policies. Writes lose both, so the RPCs
-- above are the only mutation route and the write policies can never be
-- reached again (dropped here as well, so the schema states the truth).
-- ---------------------------------------------------------------------------
revoke insert, update, delete on
  public.profiles, public.households, public.household_members,
  public.categories, public.expenses, public.budgets
  from anon, authenticated;

drop policy if exists households_insert_self_owner on public.households;
drop policy if exists households_update_owner      on public.households;
drop policy if exists households_delete_owner      on public.households;
drop policy if exists household_members_insert_owner on public.household_members;
drop policy if exists household_members_update_owner on public.household_members;
drop policy if exists household_members_delete_owner_or_self on public.household_members;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists categories_insert_owner on public.categories;
drop policy if exists categories_update_owner on public.categories;
drop policy if exists categories_delete_owner on public.categories;
drop policy if exists expenses_insert_own_identity on public.expenses;
drop policy if exists expenses_update_member_or_owner on public.expenses;
drop policy if exists expenses_delete_member_or_owner on public.expenses;
drop policy if exists budgets_insert_owner on public.budgets;
drop policy if exists budgets_update_owner      on public.budgets;
drop policy if exists budgets_delete_owner      on public.budgets;

-- ---------------------------------------------------------------------------
-- Debug scaffolding removal
--
-- Everything created while tracking down the write-path failure.
-- ---------------------------------------------------------------------------
drop trigger if exists _debug_households_ins  on public.households;
drop trigger if exists _debug_households_stmt on public.households;
drop policy if exists _zz_open on public.households;
drop policy if exists debug_log_read  on public._debug_insert_log;
drop policy if exists debug_log_write on public._debug_insert_log;

drop table if exists public._debug_insert_log;
drop function if exists public._debug_capture_insert();
drop function if exists public._debug_capture_stmt();
drop function if exists public._debug_dump();
drop function if exists public._debug_final();
drop function if exists public._debug_try_rls();
drop function if exists public._debug_try_definer();
drop function if exists public._debug_structure();
drop function if exists public._debug_triggers();
drop function if exists public._debug_policies();
drop function if exists public._debug_request_headers();

notify pgrst, 'reload schema';
