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

/** Installs (or clears) the session token and notifies subscribers. */
export function setSessionToken(token: string | null): void {
  writeStoredToken(token);
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
    // Drop anything a previous supabase-js auth session may have stored.
    try {
      window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
    const token = readStoredToken();
    cachedClient = createClient<Database>(supabaseEnv.url, supabaseEnv.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          'X-Client-Info': 'familyledger-web/1.0.0',
          ...(token ? { [SESSION_HEADER]: token } : {}),
        },
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

