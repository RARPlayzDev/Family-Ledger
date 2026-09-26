/**
 * Interprets the `error` / `error_code` / `error_description` parameters that
 * Supabase appends when it bounces a failed email link back to the app — most
 * often an expired or already-used verification OTP (`otp_expired`).
 *
 * The PKCE flow puts them in the query string; the implicit flow puts them in
 * the hash fragment, so both are inspected.
 */

export type AuthLinkError = {
  /** `error_code` when present, otherwise the bare `error` value. */
  code: string;
  description: string | null;
};

/** Parameter keys Supabase uses for auth redirect failures. */
const ERROR_KEYS = ['error', 'error_code', 'error_description'] as const;

/** Plain-language explanations for the codes Supabase actually emits. */
const FRIENDLY_MESSAGES: Record<string, string> = {
  otp_expired:
    'That verification link expired or was already used — links only work once. Request a fresh one below.',
  otp_missing: 'That verification link is incomplete. Request a fresh one below.',
  access_denied: 'The verification link was rejected. Request a fresh one below.',
  provider_email_needs_confirmation:
    'Confirm your email address from the newest link we sent, then sign in again.',
  redirect_mismatch:
    'This link points at a different address than this app. Check the Site URL and Redirect URLs in your Supabase auth settings.',
  bad_code_verifier:
    'The sign-in state was lost — usually because another tab was open. Close extra tabs and try again.',
};

function errorFrom(params: URLSearchParams): AuthLinkError | null {
  const code = params.get('error_code') ?? params.get('error');
  if (!code) return null;
  return {
    code,
    description: params.get('error_description'),
  };
}

function paramsFrom(raw: string, prefix: string): URLSearchParams {
  return new URLSearchParams(raw.startsWith(prefix) ? raw.slice(prefix.length) : raw);
}

/** Parses Supabase auth error params from a query string and/or hash fragment. */
export function parseAuthLinkError(search: string, hash: string): AuthLinkError | null {
  return errorFrom(paramsFrom(search, '?')) ?? errorFrom(paramsFrom(hash, '#'));
}

/**
 * True when the URL carries a Supabase auth callback payload: a PKCE `code`
 * (successful email-link verification) or error params from a failed one.
 * These must never be stripped before supabase-js has seen them.
 */
export function isAuthCallback(search: string, hash: string): boolean {
  if (parseAuthLinkError(search, hash)) return true;
  const query = paramsFrom(search, '?');
  const fragment = paramsFrom(hash, '#');
  return query.has('code') || fragment.has('code') || fragment.has('access_token');
}

/** Human-readable message for a bounced auth link. */
export function authLinkErrorMessage(error: AuthLinkError): string {
  return (
    FRIENDLY_MESSAGES[error.code] ??
    error.description ??
    'That sign-in link could not be used. Please try again.'
  );
}

/** Removes the error parameters from a URL, keeping everything else intact. */
export function stripAuthLinkError(
  search: string,
  hash: string,
): { search: string; hash: string } {
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const fragment = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  for (const key of ERROR_KEYS) {
    query.delete(key);
    fragment.delete(key);
  }
  const nextSearch = query.toString();
  const nextHash = fragment.toString();
  return {
    search: nextSearch ? `?${nextSearch}` : '',
    hash: nextHash ? `#${nextHash}` : '',
  };
}
