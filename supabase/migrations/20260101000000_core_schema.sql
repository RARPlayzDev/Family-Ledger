-- =============================================================================
-- FamilyLedger :: 0001 core schema
-- -----------------------------------------------------------------------------
-- ONE household = ONE shared ledger. Every member account writes into the same
-- `expenses` table scoped by `household_id`; `spent_by` records which family
-- member actually incurred the expense.
--
-- The schema is multi-household ready: every ledger table carries a NOT NULL
-- `household_id` foreign key, so a second family can be onboarded without any
-- schema change or data migration.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enumerated domains
-- ---------------------------------------------------------------------------
create type public.household_role as enum ('owner', 'member');
create type public.payment_method as enum ('upi', 'cash', 'card', 'bank_transfer', 'other');

-- ---------------------------------------------------------------------------
-- profiles : one row per authenticated account (independent of membership)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Member'
    check (char_length(btrim(display_name)) between 1 and 80),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 512),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Public user profile. Created automatically on signup. Membership lives in household_members.';

-- ---------------------------------------------------------------------------
-- households : the shared ledger container (one per family)
-- ---------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  -- v1 is INR only. Multi-currency requires an explicit conversion layer, so the
  -- value is constrained rather than silently accepted.
  currency_code text not null default 'INR' check (currency_code = 'INR'),
  timezone text not null default 'Asia/Kolkata'
    check (char_length(timezone) between 3 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.households is
  'A family household. Its expenses form ONE shared ledger visible to every member.';

-- ---------------------------------------------------------------------------
-- household_members : join table between accounts and households
-- ---------------------------------------------------------------------------
create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.household_role not null default 'member',
  joined_at timestamptz not null default now(),
  constraint household_members_pkey primary key (household_id, user_id)
);

create index household_members_user_id_idx on public.household_members (user_id);

comment on table public.household_members is
  'Which accounts belong to which household, and with which role. Roles: owner, member.';

-- ---------------------------------------------------------------------------
-- categories : system defaults (household_id IS NULL) + household categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  icon text not null default 'Tag' check (char_length(icon) between 1 and 40),
  color text not null default '#9AE6B4' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness per household; system default names must be unique too.
create unique index categories_scope_name_key
  on public.categories (
    coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(btrim(name))
  );
create index categories_household_id_idx on public.categories (household_id);

comment on table public.categories is
  'Expense categories. household_id IS NULL marks the shared system default set.';
-- ---------------------------------------------------------------------------
-- expenses : THE shared family ledger
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  -- The shared family ledger this row belongs to.
  household_id uuid not null,
  -- The family member who actually incurred the expense.
  spent_by uuid not null,
  category_id uuid references public.categories (id) on delete set null,
  -- Money is stored as integer paise (BIGINT). Never floating point.
  amount_paise bigint not null
    check (amount_paise > 0 and amount_paise <= 1000000000000), -- max ₹10,00,00,00,000
  expense_date date not null default current_date,
  merchant text check (merchant is null or char_length(btrim(merchant)) <= 120),
  note text check (note is null or char_length(note) <= 500),
  payment_method public.payment_method not null default 'upi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_household_fkey
    foreign key (household_id) references public.households (id) on delete cascade,
  constraint expenses_spent_by_fkey
    foreign key (spent_by) references public.profiles (id) on delete restrict,
  -- Composite FK: the spender MUST already be a member of the same household.
  -- Makes "expense on behalf of another household" impossible at the storage layer.
  constraint expenses_spender_membership_fkey
    foreign key (household_id, spent_by)
    references public.household_members (household_id, user_id) on delete restrict
);

create index expenses_household_id_idx on public.expenses (household_id);
create index expenses_expense_date_idx on public.expenses (expense_date);
create index expenses_spent_by_idx on public.expenses (spent_by);
create index expenses_category_id_idx on public.expenses (category_id);
-- Primary read pattern: the shared ledger of one household over a date window.
create index expenses_household_date_idx
  on public.expenses (household_id, expense_date desc, created_at desc);

comment on table public.expenses is
  'Centralized household expense ledger. household_id = whose ledger, spent_by = which member.';

-- ---------------------------------------------------------------------------
-- budgets : household-wide budget (category_id IS NULL) + category budgets
-- ---------------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  category_id uuid references public.categories (id) on delete cascade,
  amount_paise bigint not null
    check (amount_paise > 0 and amount_paise <= 1000000000000),
  -- Always the first day of the budget month.
  period_month date not null check (period_month = date_trunc('month', period_month)::date),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One household-wide budget and at most one budget per (category, month).
create unique index budgets_scope_key
  on public.budgets (
    household_id,
    period_month,
    coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index budgets_household_period_idx on public.budgets (household_id, period_month);

comment on table public.budgets is
  'Monthly spending limits. category_id IS NULL = household-wide limit. A budget is a limit, not a balance.';

-- ---------------------------------------------------------------------------
-- invitations : secure, expiring, single-use, hash-only storage
-- ---------------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email text not null check (
    char_length(email) <= 254
    and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  -- Invitations can never grant ownership directly.
  role public.household_role not null default 'member' check (role = 'member'),
  -- SHA-256 hex digest of the one-time token. The raw token is never stored.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint invitations_expiry_after_creation check (expires_at > created_at)
);

create index invitations_household_id_idx on public.invitations (household_id);
create index invitations_pending_idx
  on public.invitations (household_id, email)
  where accepted_at is null and revoked_at is null;

comment on table public.invitations is
  'Hashed single-use invitations. No client role has direct table access; managed by Edge Functions.';

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

