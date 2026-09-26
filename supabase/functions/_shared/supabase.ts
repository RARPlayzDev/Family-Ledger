// Service-role Supabase client for Edge Functions.
// The service role key is injected by the Supabase platform and NEVER leaves
// the server runtime; it must not be exposed to the browser.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.46.1';
import type { EdgeDatabase } from './db-types.ts';

function resolveServiceKey(): string | null {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;

  // Newer projects expose the keys as a JSON object instead of separate vars.
  const secretsJson = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretsJson) {
    try {
      const parsed = JSON.parse(secretsJson) as Record<string, string | undefined>;
      return parsed.default ?? parsed.secret ?? Object.values(parsed)[0] ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

export function createAdminClient(): SupabaseClient<EdgeDatabase> {
  const url = Deno.env.get('SUPABASE_URL');
  const key = resolveServiceKey();
  if (!url || !key) {
    throw new Error('Supabase service credentials are not available to this function.');
  }
  return createClient<EdgeDatabase>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'familyledger-edge/invitations' } },
  });
}

/** Client bound to the caller's access token, so auth.getUser() is trustworthy. */
export function createCallerClient(req: Request): SupabaseClient<EdgeDatabase> | null {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const authHeader = req.headers.get('Authorization');
  if (!url || !anon || !authHeader) return null;

  return createClient<EdgeDatabase>(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });
}
