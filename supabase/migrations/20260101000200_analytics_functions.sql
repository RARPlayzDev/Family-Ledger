-- =============================================================================
-- FamilyLedger :: 0003 household aggregation functions
-- -----------------------------------------------------------------------------
-- SECURITY INVOKER on purpose: the function body runs with the caller's
-- privileges, so every RLS policy above still applies. A member of household A
-- calling these with household B simply receives zero rows.
--
-- These exist so the dashboard/analytics pages ask PostgreSQL to do the
-- aggregation instead of downloading the whole ledger into the browser.
-- =============================================================================

create or replace function public.household_period_totals(
  p_household_id uuid,
  p_from date,
  p_to date
)
returns table (
  total_paise bigint,
  expense_count bigint,
  member_count bigint,
  largest_expense_paise bigint,
  average_expense_paise bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    coalesce(sum(e.amount_paise), 0)::bigint as total_paise,
    count(e.id)::bigint as expense_count,
    count(distinct e.spent_by)::bigint as member_count,
    coalesce(max(e.amount_paise), 0)::bigint as largest_expense_paise,
    coalesce(round(avg(e.amount_paise)), 0)::bigint as average_expense_paise
  from public.expenses e
  where e.household_id = p_household_id
    and e.expense_date between p_from and p_to;
$$;

create or replace function public.household_category_totals(
  p_household_id uuid,
  p_from date,
  p_to date
)
returns table (
  category_id uuid,
  category_name text,
  category_icon text,
  category_color text,
  total_paise bigint,
  expense_count bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    e.category_id,
    coalesce(c.name, 'Uncategorised') as category_name,
    coalesce(c.icon, 'Tag') as category_icon,
    coalesce(c.color, '#6C737D') as category_color,
    sum(e.amount_paise)::bigint as total_paise,
    count(e.id)::bigint as expense_count
  from public.expenses e
  left join public.categories c on c.id = e.category_id
  where e.household_id = p_household_id
    and e.expense_date between p_from and p_to
  group by e.category_id, c.name, c.icon, c.color
  order by sum(e.amount_paise) desc;
$$;

-- Includes members with zero spending so comparisons stay meaningful.
create or replace function public.household_member_totals(
  p_household_id uuid,
  p_from date,
  p_to date
)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  role public.household_role,
  total_paise bigint,
  expense_count bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    m.user_id,
    coalesce(p.display_name, 'Member') as display_name,
    p.avatar_url,
    m.role,
    coalesce(sum(e.amount_paise), 0)::bigint as total_paise,
    count(e.id)::bigint as expense_count
  from public.household_members m
  left join public.profiles p on p.id = m.user_id
  left join public.expenses e
    on e.spent_by = m.user_id
   and e.household_id = m.household_id
   and e.expense_date between p_from and p_to
  where m.household_id = p_household_id
  group by m.user_id, p.display_name, p.avatar_url, m.role, m.joined_at
  order by coalesce(sum(e.amount_paise), 0) desc, m.joined_at asc;
$$;

-- One row per calendar day (including empty days) for charting.
create or replace function public.household_daily_totals(
  p_household_id uuid,
  p_from date,
  p_to date
)
returns table (
  day date,
  total_paise bigint,
  expense_count bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    d.day::date as day,
    coalesce(sum(e.amount_paise), 0)::bigint as total_paise,
    count(e.id)::bigint as expense_count
  from generate_series(p_from, p_to, interval '1 day') as d(day)
  left join public.expenses e
    on e.household_id = p_household_id
   and e.expense_date = d.day::date
  where p_to >= p_from
  group by d.day
  order by d.day;
$$;

revoke all on function public.household_period_totals(uuid, date, date) from public, anon;
revoke all on function public.household_category_totals(uuid, date, date) from public, anon;
revoke all on function public.household_member_totals(uuid, date, date) from public, anon;
revoke all on function public.household_daily_totals(uuid, date, date) from public, anon;

grant execute on function public.household_period_totals(uuid, date, date) to anon;
grant execute on function public.household_category_totals(uuid, date, date) to anon;
grant execute on function public.household_member_totals(uuid, date, date) to anon;
grant execute on function public.household_daily_totals(uuid, date, date) to anon;
