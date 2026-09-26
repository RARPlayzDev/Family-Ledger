/// <reference types="vite/client" />

/**
 * Environment variables consumed by the browser bundle.
 * Everything prefixed with VITE_ is PUBLIC: only the anon / publishable key
 * belongs here. See .env.example and SECURITY.md.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Optional: points the RLS integration test suite at a scratch project. */
  readonly VITE_TEST_SUPABASE_URL?: string;
  readonly VITE_TEST_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
