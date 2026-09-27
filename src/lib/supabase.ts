import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseEnv } from '@/lib/env';
import type { Database } from '@/types/database';

export class AppConfigurationError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(
      problems.length > 0
        ? `Supabase is not configured: ${problems.join(' ')}`
        : 'Supabase is not configured.',
    );
    this.name = 'AppConfigurationError';
    this.problems = problems;
  }
}

/**
 * Custom session token storage (no Supabase Auth).
 *
 * The raw token lives in localStorage and is attached to every PostgREST
 * request as the `x-familyledger-session` header. SQL resolves the caller from
 * that header (public.session_user_id), which is what RLS policies use.
 * Changing the token drops the memoised client so the next request carries the
 * fresh header.
 */
const TOKEN_STORAGE_KEY = 'familyledger-session-token';
const CACHED_USER_KEY = 'familyledger-session-user';
const LEGACY_AUTH_STORAGE_KEY = 'familyledger-auth';
export const SESSION_HEADER = 'x-familyledger-session';

type TokenListener = () => void;
const tokenListeners = new Set<TokenListener>();

let cachedClient: SupabaseClient<Database> | null = null;

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable (private mode): the app still works for this tab.
  }
}

export function getSessionToken(): string | null {
  return readStoredToken();
}

/**
 * JSON of the profile cached at sign-in. Lets a reload boot straight into the
 * app (even offline); resolve_session refreshes it quietly when reachable.
 */
export function getCachedSessionUserJson(): string | null {
  try {
    return window.localStorage.getItem(CACHED_USER_KEY);
  } catch {
    return null;
  }
}

/** Refreshes the cached profile WITHOUT notifying session listeners. */
export function setCachedSessionUserJson(json: string | null): void {
  try {
    if (json) {
      window.localStorage.setItem(CACHED_USER_KEY, json);
    } else {
      window.localStorage.removeItem(CACHED_USER_KEY);
    }
  } catch {
    // Storage unavailable: resolve_session will repopulate it when reachable.
  }
}

/**
 * Installs (or clears) the session and notifies subscribers.
 * The profile (when given) is cached alongside the token; clearing the token
 * clears the cache too, so token and profile can never diverge.
 */
export function setSessionToken(token: string | null, user?: unknown): void {
  writeStoredToken(token);
  setCachedSessionUserJson(token && user ? JSON.stringify(user) : null);
  cachedClient = null;
  for (const listener of tokenListeners) listener();
}

/** Subscribe to token changes (sign-in, sign-out, restore). Returns unsubscribe. */
export function onSessionTokenChange(listener: TokenListener): () => void {
  tokenListeners.add(listener);
  return () => {
    tokenListeners.delete(listener);
  };
}

/**
 * Attaches the CURRENT session token to every request at send time (not at
 * client creation), so even a client instance created before sign-in can
 * never send a missing or stale session header.
 */
const withSessionHeader: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  const token = readStoredToken();
  if (token) {
    headers.set(SESSION_HEADER, token);
  } else {
    headers.delete(SESSION_HEADER);
  }
  return fetch(input, { ...init, headers });
};

/**
 * Lazily creates the single browser Supabase client.
 *
 * Only the publishable/anon key is used - requests arrive as the `anon`
 * database role and carry the session header when one exists.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!supabaseEnv.isConfigured) {
    throw new AppConfigurationError(supabaseEnv.problems);
  }
  if (!cachedClient) {
    // Drop anything a previous supabase auth session may have stored.
    try {
      window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
    cachedClient = createClient<Database>(supabaseEnv.url, supabaseEnv.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          'X-Client-Info': 'familyledger-web/1.0.0',
        },
        fetch: withSessionHeader,
      },
    });
  }
  return cachedClient;
}

export function isSupabaseConfigured(): boolean {
  return supabaseEnv.isConfigured;
}

/** Test helper: drop the memoised client. */
export function resetSupabaseClient(): void {
  cachedClient = null;
}

