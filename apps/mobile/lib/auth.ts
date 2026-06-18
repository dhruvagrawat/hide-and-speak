import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from './supabase';

// Required for expo-web-browser auth session to complete on Android
WebBrowser.maybeCompleteAuthSession();

/**
 * Google OAuth via Supabase.
 *
 * Setup required (one-time, in Supabase dashboard):
 *  1. Authentication → Providers → Google → Enable
 *  2. Paste your Google Cloud OAuth Client ID + Secret
 *  3. Add redirect URI: https://<project-ref>.supabase.co/auth/v1/callback
 *
 * Setup required in Google Cloud Console:
 *  1. Create an OAuth 2.0 Client ID (Web application type)
 *  2. Add authorised redirect URI: https://<project-ref>.supabase.co/auth/v1/callback
 */
export async function signInWithGoogle(): Promise<void> {
  const redirectUri = makeRedirectUri({ scheme: 'hidespeak', path: 'auth/callback' });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUri,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) throw error ?? new Error('No OAuth URL returned');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

  if (result.type !== 'success') return;

  // Supabase returns tokens in the URL hash fragment after redirect
  const fragment = result.url.split('#')[1] ?? '';
  const params = Object.fromEntries(new URLSearchParams(fragment));

  if (params.access_token && params.refresh_token) {
    const { error: sessionErr } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (sessionErr) throw sessionErr;
  }
}

/**
 * Phone OTP via Vonage (configured in Supabase dashboard).
 *
 * Setup required (one-time, in Supabase dashboard):
 *  1. Authentication → Providers → Phone → Enable
 *  2. SMS Provider → Vonage
 *  3. Enter your Vonage API Key + API Secret (see root .env.local — never commit real keys here)
 *  4. Set "From" to your Vonage virtual number
 */
export async function sendPhoneOtp(
  phone: string,
  // Passed only when registering via phone — stored as signup metadata so the
  // profile trigger can save the username + (unverified) email. Ignored by
  // Supabase for users who already exist (i.e. plain login).
  data?: { username?: string; email?: string },
): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: data ? { data } : undefined,
  });
  if (error) throw error;
}

export async function verifyPhoneOtp(phone: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
  if (error) throw error;
}
