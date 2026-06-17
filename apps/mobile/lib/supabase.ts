import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * True when the public Supabase env vars were actually inlined into this
 * build. They're only present if EXPO_PUBLIC_SUPABASE_* were set at build
 * time (local `.env.local`, or eas.json / EAS env for cloud builds). If they
 * weren't, `createClient` would throw at import and crash the app the instant
 * it opens — so we fall back to harmless placeholders and let the UI surface a
 * readable "not configured" state instead of a hard native crash.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
