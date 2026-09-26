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

let cachedClient: SupabaseClient<Database> | null = null;

/**
 * Lazily creates the single browser Supabase client.
 *
 * Session handling is delegated to supabase-js (`persistSession`): the SDK keeps
 * the session in localStorage and refreshes it automatically. No auth token is
 * ever copied into a custom store, which is what the Supabase guidance for
 * WebViews (Android included) recommends.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!supabaseEnv.isConfigured) {
    throw new AppConfigurationError(supabaseEnv.problems);
  }
  if (!cachedClient) {
    cachedClient = createClient<Database>(supabaseEnv.url, supabaseEnv.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'familyledger-auth',
      },
      global: { headers: { 'X-Client-Info': 'familyledger-web/1.0.0' } },
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
