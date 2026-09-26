-- =============================================================================
-- FamilyLedger :: 0004 shared system categories
-- -----------------------------------------------------------------------------
-- household_id IS NULL marks these as the default set available to every
-- household. Stable UUIDs keep the seed idempotent (re-running only refreshes
-- labels/icons/colours) and let the UI reference them safely.
-- =============================================================================

insert into public.categories (id, household_id, name, icon, color, is_active, created_by)
values
  ('a1000000-0000-4000-8000-000000000001', null, 'Groceries',          'ShoppingCart',    '#9AE6B4', true, null),
  ('a1000000-0000-4000-8000-000000000002', null, 'Food & Dining',      'UtensilsCrossed', '#F2C879', true, null),
  ('a1000000-0000-4000-8000-000000000003', null, 'Transport',          'Car',             '#8AB4F8', true, null),
  ('a1000000-0000-4000-8000-000000000004', null, 'Bills & Utilities',  'ReceiptText',     '#A79CF5', true, null),
  ('a1000000-0000-4000-8000-000000000005', null, 'Shopping',           'ShoppingBag',     '#F09BB4', true, null),
  ('a1000000-0000-4000-8000-000000000006', null, 'Health',             'HeartPulse',      '#F4948A', true, null),
  ('a1000000-0000-4000-8000-000000000007', null, 'Education',          'GraduationCap',   '#7FD8D0', true, null),
  ('a1000000-0000-4000-8000-000000000008', null, 'Entertainment',      'Clapperboard',    '#E4A0D0', true, null),
  ('a1000000-0000-4000-8000-000000000009', null, 'Household',          'Home',            '#B7C0CC', true, null),
  ('a1000000-0000-4000-8000-00000000000a', null, 'Travel',             'Plane',           '#8FD0F0', true, null),
  ('a1000000-0000-4000-8000-00000000000b', null, 'Other',              'Tag',             '#6C737D', true, null)
on conflict (id) do update
  set name = excluded.name,
      icon = excluded.icon,
      color = excluded.color,
      is_active = true;
