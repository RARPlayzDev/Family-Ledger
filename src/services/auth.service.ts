import { getSupabase, getSessionToken, setSessionToken } from '@/lib/supabase';

/**
 * Custom authentication (no Supabase Auth, no emails).
 *
 * sign_up / login / resolve_session / logout are SECURITY DEFINER RPCs in
 * 000050_custom_auth.sql. Passwords are verified by bcrypt inside PostgreSQL,
 * so hashes never leave the database; the client only ever sees a random
 * session token, which lib/supabase.ts attaches to every request as the
 * `x-familyledger-session` header.
 */

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
};

export type AppSession = {
  token: string;
  user: AuthUser;
};

type AuthRpcResult = { token: string; user: AuthUser };

function toSession(result: AuthRpcResult | null): AppSession {
  if (!result || !result.token || !result.user) {
    throw new Error('The server did not return a session. Please try again.');
  }
  return { token: result.token, user: result.user };
}

/** Creates an account and signs in immediately (single transaction). */
export async function signUp(input: {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}): Promise<AppSession> {
  const payload = input.displayName?.trim()
    ? {
        p_email: input.email.trim().toLowerCase(),
        p_username: input.username.trim().toLowerCase(),
        p_password: input.password,
        p_display_name: input.displayName.trim(),
      }
    : {
        p_email: input.email.trim().toLowerCase(),
        p_username: input.username.trim().toLowerCase(),
        p_password: input.password,
      };
  const { data, error } = await getSupabase().rpc('sign_up', payload);
  if (error) throw error;
  const session = toSession(data);
  setSessionToken(session.token);
  return session;
}

/** Signs in with either the email address or the username. */
export async function signIn(identifier: string, password: string): Promise<AppSession> {
  const { data, error } = await getSupabase().rpc('login', {
    p_identifier: identifier.trim().toLowerCase(),
    p_password: password,
  });
  if (error) throw error;
  const session = toSession(data);
  setSessionToken(session.token);
  return session;
}

/**
 * Restores the session stored in localStorage on boot.
 * Returns null when there is no token or it has expired/been revoked.
 */
export async function resolveStoredSession(): Promise<AppSession | null> {
  const token = getSessionToken();
  if (!token) return null;
  try {
    const { data, error } = await getSupabase().rpc('resolve_session', { p_token: token });
    if (error) throw error;
    if (!data?.user) {
      setSessionToken(null);
      return null;
    }
    return { token, user: data.user };
  } catch {
    // Offline or server hiccup: do NOT destroy a possibly-valid session here;
    // the app shows its error/retry states instead.
    return null;
  }
}

/** Revokes the current token server-side and clears local state. */
export async function signOut(): Promise<void> {
  const token = getSessionToken();
  try {
    if (token) {
      const { error } = await getSupabase().rpc('logout', { p_token: token });
      if (error) throw error;
    }
  } finally {
    setSessionToken(null);
  }
}

/** Initials for the avatar fallback ("Priya Nair" -> "PN"). */
export function initialsFromName(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
