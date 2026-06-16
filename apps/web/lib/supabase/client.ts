import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for use in the browser (Client Components).
 * Mirrors apps/mobile/lib/supabase.ts but uses cookie-based sessions
 * via @supabase/ssr so auth state is shared with the server.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
