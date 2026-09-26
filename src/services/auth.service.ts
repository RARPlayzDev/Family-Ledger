import type { Session, User } from '@supabase/supabase-js';
import { appOrigin } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';

/**
 * Authentication wrapper.
 *
 * Every call goes through supabase-js so session persistence, token refresh and
 * the PKCE flow are handled by the SDK - the app never stores tokens itself.
 */

export type AuthResult = {
  user: User | null;
  session: Session | null;
  /** true when the user must confirm their email before a session exists. */
  needsEmailConfirmation: boolean;
};

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(
  callback: (session: Session | null, event: string) => void,
): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
    callback(session, event);
  });
  return () => data.subscription.unsubscribe();
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  return { user: data.user, session: data.session, needsEmailConfirmation: false };
}

export async function signUpWithPassword(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResult> {
  const { data, error } = await getSupabase().auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { display_name: displayName.trim() },
      emailRedirectTo: `${appOrigin()}/auth`,
    },
  });
  if (error) throw error;

  // Supabase returns a user with an empty identities array when the address is
  // already registered (it deliberately does not reveal that fact).
  const alreadyRegistered = !data.session && (data.user?.identities?.length ?? 1) === 0;
  if (alreadyRegistered) {
    throw new Error(
      'An account already exists for this email address. Sign in instead, or reset the password.',
    );
  }

  return {
    user: data.user,
    session: data.session,
    needsEmailConfirmation: !data.session,
  };
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${appOrigin()}/auth?mode=reset-password`,
  });
  if (error) throw error;
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) throw error;
}

export async function resendConfirmationEmail(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: `${appOrigin()}/auth` },
  });
  if (error) throw error;
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
