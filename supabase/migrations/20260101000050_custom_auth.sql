-- =============================================================================
-- FamilyLedger :: 0001b custom authentication (NO Supabase Auth, NO emails)
-- -----------------------------------------------------------------------------
-- Accounts live in public.profiles with bcrypt password hashes. The client
-- talks to three SECURITY DEFINER RPCs (sign_up / login / resolve_session) that
-- hand back a random 64-hex session token. The browser stores that token and
-- sends it on EVERY request in the x-familyledger-session header.
--
-- PostgREST exposes request headers to SQL as a JSON GUC (request.headers,
-- PostgREST >= 12), so public.session_user_id() resolves the caller inside RLS
-- policies. Public/sign-up RPCs are executable by the anon role (client
-- requests carry the publishable/anon key); the session/attempt tables have RLS
-- enabled with zero policies and no grants, so they are unreachable directly.
--
-- No table here is ever read or written by the client except through these
-- functions: password hashes never leave the database.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- sessions : hashed bearer tokens (raw token exists only in the browser)
-- ---------------------------------------------------------------------------
create table public.sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index sessions_user_id_idx on public.sessions (user_id);

comment on table public.sessions is
  'SHA-256 of the session token issued by sign_up/login. Raw tokens never hit the database. Sessions never expire - logout is the only way out.';

alter table public.sessions enable row level security;
-- Deliberately zero policies: no client role can touch sessions directly.

-- ---------------------------------------------------------------------------
-- login_attempts : lock a single account for 15 minutes after 10 failures
-- ---------------------------------------------------------------------------
create table public.login_attempts (
  identifier text primary key check (char_length(identifier) between 1 and 254),
  failed_count integer not null default 1 check (failed_count > 0),
  window_started_at timestamptz not null default now(),
  last_attempt_at timestamptz not null default now()
);

alter table public.login_attempts enable row level security;
-- Deliberately zero policies: only the login RPC touches this table.

revoke all on public.sessions from anon, authenticated;
revoke all on public.login_attempts from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Who am I? Reads the session token from the request header.
-- ---------------------------------------------------------------------------
create or replace function public._request_session_token()
returns text
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select e.value
  from json_each(
    coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json
  ) as e
  where lower(e.key) = 'x-familyledger-session'
  limit 1
$$;

-- The single identity primitive for every RLS policy. Returns NULL when there
-- is no (valid) session, which makes every policy fail closed.
create or replace function public.session_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select s.user_id
  from public.sessions s
  where s.token_hash = encode(digest(public._request_session_token(), 'sha256'), 'hex')
$$;

revoke all on function public._request_session_token() from public, anon;
revoke all on function public.session_user_id() from public;
-- RLS policy expressions run as the querying role, so anon needs to execute
-- session_user_id (it only ever resolves the caller's own session).
grant execute on function public.session_user_id() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal helpers: issue sessions and render profiles without the hash
-- ---------------------------------------------------------------------------
create or replace function public._issue_session(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_token text := encode(gen_random_bytes(32), 'hex');
begin
  insert into public.sessions (token_hash, user_id)
  values (encode(digest(v_token, 'sha256'), 'hex'), p_user_id);

  return v_token;
end;
$$;

create or replace function public._profile_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select jsonb_build_object(
    'id', p.id,
    'email', p.email,
    'username', p.username,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'created_at', p.created_at
  )
  from public.profiles p
  where p.id = p_id
$$;

revoke all on function public._issue_session(uuid) from public, anon;
revoke all on function public._profile_json(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- sign_up : create an account and start a session in one transaction
-- ---------------------------------------------------------------------------
create or replace function public.sign_up(
  p_email text,
  p_username text,
  p_password text,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_display text := left(btrim(coalesce(nullif(p_display_name, ''), v_username)), 80);
  v_id uuid;
  v_token text;
begin
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or char_length(v_email) > 254 then
    raise exception 'Enter a valid email address.';
  end if;

  if v_username !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'Username must be 3-30 characters using letters, numbers or underscores.';
  end if;

  if char_length(coalesce(p_password, '')) < 6 then
    raise exception 'Password must be at least 6 characters.';
  end if;

  if exists (select 1 from public.profiles p where p.email = v_email) then
    raise exception 'That email address is already registered. Sign in instead.';
  end if;

  if exists (select 1 from public.profiles p where p.username = v_username) then
    raise exception 'That username is already taken. Choose another.';
  end if;

  begin
    insert into public.profiles (email, username, password_hash, display_name)
    values (v_email, v_username, crypt(p_password, gen_salt('bf')), v_display)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'That email address or username is already registered.';
  end;

  v_token := public._issue_session(v_id);

  return jsonb_build_object('token', v_token, 'user', public._profile_json(v_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- login : match email OR username against the stored bcrypt hash
-- ---------------------------------------------------------------------------
create or replace function public.login(p_identifier text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_key text := lower(btrim(coalesce(p_identifier, '')));
  v_password text := coalesce(p_password, '');
  v_id uuid;
  v_hash text;
  v_failed integer;
  v_started timestamptz;
  v_token text;
begin
  if v_key = '' or v_password = '' then
    raise exception 'Enter your email/username and password.';
  end if;

  select a.failed_count, a.window_started_at
    into v_failed, v_started
    from public.login_attempts a
   where a.identifier = v_key;

  if found and v_failed >= 10 and v_started > now() - interval '15 minutes' then
    raise exception 'Too many failed attempts. Try again in 15 minutes.';
  end if;

  select p.id, p.password_hash
    into v_id, v_hash
    from public.profiles p
   where p.email = v_key or p.username = v_key
   limit 1;

  if v_id is null or v_hash is null or crypt(v_password, v_hash) is distinct from v_hash then
    insert into public.login_attempts as a (identifier, failed_count, window_started_at, last_attempt_at)
    values (v_key, 1, now(), now())
    on conflict (identifier) do update set
      failed_count = case
        when a.window_started_at <= now() - interval '15 minutes' then 1
        else a.failed_count + 1
      end,
      window_started_at = case
        when a.window_started_at <= now() - interval '15 minutes' then now()
        else a.window_started_at
      end,
      last_attempt_at = now();

    -- Deliberately generic: never reveals whether the account exists.
    raise exception 'Incorrect email/username or password.';
  end if;

  delete from public.login_attempts where identifier = v_key;

  v_token := public._issue_session(v_id);

  return jsonb_build_object('token', v_token, 'user', public._profile_json(v_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- resolve_session : validate a stored token on boot (token passed as an
-- argument, so restore works even before any header is configured)
-- ---------------------------------------------------------------------------
create or replace function public.resolve_session(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select jsonb_build_object('token', p_token, 'user', public._profile_json(s.user_id))
  from public.sessions s
  where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;

-- ---------------------------------------------------------------------------
-- logout : revoke the presented token
-- ---------------------------------------------------------------------------
create or replace function public.logout(p_token text)
returns void
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  delete from public.sessions
   where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;

-- ---------------------------------------------------------------------------
-- Executable by client requests only; internals stay unreachable.
-- ---------------------------------------------------------------------------
revoke all on function public.sign_up(text, text, text, text) from public;
revoke all on function public.login(text, text) from public;
revoke all on function public.resolve_session(text) from public;
revoke all on function public.logout(text) from public;

grant execute on function public.sign_up(text, text, text, text) to anon, authenticated;
grant execute on function public.login(text, text) to anon, authenticated;
grant execute on function public.resolve_session(text) to anon, authenticated;
grant execute on function public.logout(text) to anon, authenticated;


