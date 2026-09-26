-- =============================================================================
-- FamilyLedger :: 0002 membership integrity, helpers and Row Level Security
-- -----------------------------------------------------------------------------
-- Access model (see SECURITY.md for the full write-up):
--   * a household is a set of accounts joined through household_members
--   * every ledger query is scoped to a household the caller belongs to
--   * expenses.spent_by must equal auth.uid() on insert -> no spender spoofing
--   * members mutate their own expenses; owners administer the household
--   * invitations have no client policies at all; only Edge Functions touch them
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Membership predicates
-- ---------------------------------------------------------------------------
-- Internal variants take an explicit user id and are NOT executable by client
-- roles, so the API cannot be used to enumerate other people's memberships.
create or replace function public._member_of(p_household_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = p_household_id
      and m.user_id = p_user_id
  );
$$;

create or replace function public._owner_of(p_household_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.households h
    where h.id = p_household_id
      and h.owner_id = p_user_id
  );
$$;

-- Public wrappers used inside RLS policies. They only ever reason about
-- auth.uid(), so a caller cannot probe someone else's membership.
create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public._member_of(p_household_id, auth.uid());
$$;

create or replace function public.is_household_owner(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public._owner_of(p_household_id, auth.uid());
$$;

-- "Do I share a household with this profile?" - used to let members read the
-- names/avatars of their own family members only.
create or replace function public.shares_household_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members theirs
      on theirs.household_id = mine.household_id
    where mine.user_id = auth.uid()
      and theirs.user_id = p_user_id
  );
$$;

revoke all on function public._member_of(uuid, uuid) from public, anon, authenticated;
revoke all on function public._owner_of(uuid, uuid) from public, anon, authenticated;
revoke all on function public.is_household_member(uuid) from public, anon;
revoke all on function public.is_household_owner(uuid) from public, anon;
revoke all on function public.shares_household_with(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.shares_household_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Profile bootstrap on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_display_name text;
begin
  v_display_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if v_display_name is null then
    v_display_name := coalesce(
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Member'
    );
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, left(v_display_name, 80))
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
-- ---------------------------------------------------------------------------
-- Household creation -> owner membership row (kept in sync on transfer)
-- ---------------------------------------------------------------------------
create or replace function public.sync_household_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- The owner must be an existing profile (FK on households.owner_id guarantees it).
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (household_id, user_id)
    do update set role = 'owner';

  -- Demote the previous owner when ownership is transferred.
  if tg_op = 'UPDATE' and old.owner_id <> new.owner_id then
    update public.household_members
       set role = 'member'
     where household_id = new.id
       and user_id = old.owner_id;
  end if;

  return new;
end;
$$;

create trigger households_sync_owner_membership
  after insert or update of owner_id on public.households
  for each row execute function public.sync_household_owner_membership();

-- Ownership may only be transferred to somebody who already belongs to the
-- household. This blocks privilege escalation through a forged owner_id.
create or replace function public.assert_owner_is_member()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.owner_id <> old.owner_id then
    if not public._member_of(old.id, new.owner_id) then
      raise exception 'The new owner must already be a member of this household'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger households_assert_owner_is_member
  before update of owner_id on public.households
  for each row execute function public.assert_owner_is_member();

-- ---------------------------------------------------------------------------
-- household_members integrity guards
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

create trigger household_members_guard
  before insert or update or delete on public.household_members
  for each row execute function public.guard_household_member();

-- ---------------------------------------------------------------------------
-- Expense integrity guards
-- ---------------------------------------------------------------------------
create or replace function public.guard_expense()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_category_household uuid;
  v_category_active boolean;
begin
  -- An expense can never be moved to another family's ledger.
  if tg_op = 'UPDATE' and new.household_id <> old.household_id then
    raise exception 'An expense cannot be moved to another household'
      using errcode = 'check_violation';
  end if;

  -- Changing who spent the money is an owner-only administrative action.
  if tg_op = 'UPDATE' and new.spent_by <> old.spent_by then
    if not public._owner_of(old.household_id, auth.uid()) then
      raise exception 'Only the household owner can reassign an expense to another member'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if new.category_id is not null then
    select c.household_id, c.is_active
      into v_category_household, v_category_active
      from public.categories c
     where c.id = new.category_id;

    if not found then
      raise exception 'Category % does not exist', new.category_id
        using errcode = 'foreign_key_violation';
    end if;

    -- A category is usable when it is a system default (household_id IS NULL)
    -- or when it belongs to the very same household.
    if v_category_household is not null and v_category_household <> new.household_id then
      raise exception 'Category does not belong to this household'
        using errcode = 'check_violation';
    end if;

    if tg_op = 'INSERT' and v_category_active is not true then
      raise exception 'This category is archived and cannot be used for new expenses'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger expenses_guard
  before insert or update on public.expenses
  for each row execute function public.guard_expense();

-- ---------------------------------------------------------------------------
-- Budget integrity guard
-- ---------------------------------------------------------------------------
create or replace function public.guard_budget()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_category_household uuid;
begin
  if new.category_id is not null then
    select c.household_id into v_category_household
      from public.categories c
     where c.id = new.category_id;

    if not found then
      raise exception 'Category % does not exist', new.category_id
        using errcode = 'foreign_key_violation';
    end if;

    if v_category_household is not null and v_category_household <> new.household_id then
      raise exception 'Category does not belong to this household'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger budgets_guard
  before insert or update on public.budgets
  for each row execute function public.guard_budget();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.budgets enable row level security;
alter table public.invitations enable row level security;

-- profiles -------------------------------------------------------------------
create policy profiles_select_family
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.shares_household_with(id));

create policy profiles_insert_self
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_delete_self
  on public.profiles for delete
  to authenticated
  using (id = auth.uid());

-- households -----------------------------------------------------------------
create policy households_select_member
  on public.households for select
  to authenticated
  using (public.is_household_member(id));

-- A household may only be created for yourself: the trigger then inserts the
-- matching owner membership row.
create policy households_insert_self_owned
  on public.households for insert
  to authenticated
  with check (owner_id = auth.uid());

-- Owners rename/configure their household and may hand ownership to a member.
create policy households_update_owner
  on public.households for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy households_delete_owner
  on public.households for delete
  to authenticated
  using (owner_id = auth.uid());

-- household_members ----------------------------------------------------------
create policy household_members_select_member
  on public.household_members for select
  to authenticated
  using (user_id = auth.uid() or public.is_household_member(household_id));

-- Owners may attach an existing account, but never grant the owner role and
-- never rewrite their own row through the API.
create policy household_members_insert_owner
  on public.household_members for insert
  to authenticated
  with check (
    public.is_household_owner(household_id)
    and role = 'member'
    and user_id <> auth.uid()
  );

create policy household_members_update_owner
  on public.household_members for update
  to authenticated
  using (public.is_household_owner(household_id) and user_id <> auth.uid())
  with check (
    public.is_household_owner(household_id)
    and user_id <> auth.uid()
    and role = 'member'
  );

-- Owners remove members; non-owners may only remove themselves (leave).
create policy household_members_delete_owner_or_self
  on public.household_members for delete
  to authenticated
  using (
    (user_id = auth.uid() and role = 'member')
    or (public.is_household_owner(household_id) and user_id <> auth.uid())
  );

-- categories -----------------------------------------------------------------
create policy categories_select_member_or_system
  on public.categories for select
  to authenticated
  using (household_id is null or public.is_household_member(household_id));

create policy categories_insert_owner
  on public.categories for insert
  to authenticated
  with check (
    household_id is not null
    and public.is_household_owner(household_id)
    and created_by = auth.uid()
  );

create policy categories_update_owner
  on public.categories for update
  to authenticated
  using (household_id is not null and public.is_household_owner(household_id))
  with check (household_id is not null and public.is_household_owner(household_id));

create policy categories_delete_owner
  on public.categories for delete
  to authenticated
  using (household_id is not null and public.is_household_owner(household_id));

-- expenses -------------------------------------------------------------------
-- Every member of the household reads the ONE shared ledger.
create policy expenses_select_member
  on public.expenses for select
  to authenticated
  using (public.is_household_member(household_id));

-- A member may only record an expense under their own identity, inside a
-- household they belong to. The composite FK re-checks membership in storage.
create policy expenses_insert_own_identity
  on public.expenses for insert
  to authenticated
  with check (spent_by = auth.uid() and public.is_household_member(household_id));

-- Members edit their own expenses; owners administer all household expenses.
create policy expenses_update_member_or_owner
  on public.expenses for update
  to authenticated
  using (spent_by = auth.uid() or public.is_household_owner(household_id))
  with check (spent_by = auth.uid() or public.is_household_owner(household_id));

create policy expenses_delete_member_or_owner
  on public.expenses for delete
  to authenticated
  using (spent_by = auth.uid() or public.is_household_owner(household_id));

-- budgets --------------------------------------------------------------------
create policy budgets_select_member
  on public.budgets for select
  to authenticated
  using (public.is_household_member(household_id));

create policy budgets_insert_owner
  on public.budgets for insert
  to authenticated
  with check (public.is_household_owner(household_id) and created_by = auth.uid());

create policy budgets_update_owner
  on public.budgets for update
  to authenticated
  using (public.is_household_owner(household_id))
  with check (public.is_household_owner(household_id));

create policy budgets_delete_owner
  on public.budgets for delete
  to authenticated
  using (public.is_household_owner(household_id));

-- invitations ----------------------------------------------------------------
-- Deliberately policy-free: RLS enabled with zero policies means no client role
-- can read or write invitations. All access goes through the Edge Functions,
-- which run with the service role and enforce owner checks in code.
revoke all on public.invitations from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Table privileges: authenticated only. Anonymous visitors have no data access.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.households, public.household_members,
  public.categories, public.expenses, public.budgets
  from anon;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.households to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.budgets to authenticated;

