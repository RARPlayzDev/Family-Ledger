/**
 * Environment configuration.
 *
 * Only PUBLIC browser keys belong in VITE_ variables. This module refuses to
 * build a client from anything that looks like a privileged key, so a service
 * role / secret key pasted into .env cannot silently leak through the bundle.
 */

const SERVICE_KEY_PATTERN = /(^sb_secret_)|(^sbp_)|(service_role)/i;

export type SupabaseEnvCheck = {
  isConfigured: boolean;
  url: string;
  anonKey: string;
  problems: string[];
};

function readVar(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Decodes the `role` claim of a Supabase legacy JWT key without verifying it. */
function jwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export function checkSupabaseEnv(
  urlRaw: unknown,
  keyRaw: unknown,
): SupabaseEnvCheck {
  const url = readVar(urlRaw);
  const anonKey = readVar(keyRaw);
  const problems: string[] = [];

  if (!url) {
    problems.push('VITE_SUPABASE_URL is not set.');
  } else if (!/^https?:\/\/[^\s]+$/i.test(url)) {
    problems.push('VITE_SUPABASE_URL must be a full URL such as https://your-project.supabase.co');
  }

  if (!anonKey) {
    problems.push('VITE_SUPABASE_ANON_KEY is not set.');
  } else if (SERVICE_KEY_PATTERN.test(anonKey) || jwtRole(anonKey) === 'service_role') {
    problems.push(
      'VITE_SUPABASE_ANON_KEY looks like a service_role/secret key. Only the anon or publishable key may be exposed to the browser.',
    );
  }

  return {
    isConfigured: problems.length === 0,
    url,
    anonKey,
    problems,
  };
}

export const supabaseEnv: SupabaseEnvCheck = checkSupabaseEnv(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export const APP_NAME = 'FamilyLedger';
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/** Absolute app origin (used for shareable household join links). */
export function appOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}
