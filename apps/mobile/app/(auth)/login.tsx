import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { sendPhoneOtp, signInWithGoogle } from '@/lib/auth';
import { Colors } from '@/constants/colors';
import { LogoMark, Wordmark } from '@/components/Logo';

type AuthTab = 'email' | 'phone';

export default function Login() {
  const [tab, setTab] = useState<AuthTab>('email');

  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Phone state
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Guard every auth action: if the build shipped without Supabase env vars,
  // the client points at a placeholder host and every request dies with a
  // cryptic DNS error. Fail loudly and clearly instead.
  const backendReady = () => {
    if (!isSupabaseConfigured) {
      Alert.alert(
        'Not connected',
        'This build is missing its backend configuration (EXPO_PUBLIC_SUPABASE_URL / ANON_KEY). Rebuild with those env vars set.',
      );
      return false;
    }
    return true;
  };

  // ── Email login ───────────────────────────
  const handleEmailLogin = async () => {
    if (!backendReady()) return;
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) Alert.alert('Login failed', error.message);
  };

  // ── Phone OTP ─────────────────────────────
  const handlePhoneSend = async () => {
    if (!backendReady()) return;
    const trimmed = phone.trim();
    if (!trimmed) {
      Alert.alert('Missing field', 'Please enter your phone number.');
      return;
    }
    if (!trimmed.startsWith('+')) {
      Alert.alert('Invalid format', 'Phone number must start with + and country code.\nExample: +919876543210');
      return;
    }
    setLoading(true);
    try {
      await sendPhoneOtp(trimmed);
      router.push({ pathname: '/(auth)/otp', params: { phone: trimmed } });
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not send OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ── Google OAuth (works in a dev/preview build, not Expo Go) ──
  const handleGoogle = async () => {
    if (!backendReady()) return;
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (e: unknown) {
      Alert.alert('Google sign-in failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient colors={['#0D0D0D', '#1a0a2e', '#0D0D0D']} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={styles.logoArea}>
          <LogoMark size={76} style={{ marginBottom: 16 }} />
          <Wordmark size={28} />
          <Text style={styles.tagline}>Private. Secure. Just for you.</Text>
        </View>

        <View style={styles.card}>
          {!isSupabaseConfigured && (
            <View style={styles.warnBanner}>
              <Text style={styles.warnText}>
                Backend not configured — this build is missing its Supabase env vars. Auth won’t work until it’s rebuilt with them.
              </Text>
            </View>
          )}

          {/* Tab switcher: Email / Phone */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, tab === 'email' && styles.tabActive]}
              onPress={() => setTab('email')}
            >
              <Text style={[styles.tabText, tab === 'email' && styles.tabTextActive]}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'phone' && styles.tabActive]}
              onPress={() => setTab('phone')}
            >
              <Text style={[styles.tabText, tab === 'phone' && styles.tabTextActive]}>Phone</Text>
            </TouchableOpacity>
          </View>

          {/* ── Email form ── */}
          {tab === 'email' && (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleEmailLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* ── Phone form ── */}
          {tab === 'phone' && (
            <>
              <Text style={styles.label}>Phone number</Text>
              <TextInput
                style={styles.input}
                placeholder="+919876543210"
                placeholderTextColor={Colors.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCorrect={false}
              />
              <Text style={styles.hint}>Include country code — e.g. +1 US · +91 India · +44 UK</Text>
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handlePhoneSend}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP via SMS</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google */}
          <TouchableOpacity
            style={[styles.googleBtn, googleLoading && styles.buttonDisabled]}
            onPress={handleGoogle}
            disabled={googleLoading}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator color={Colors.text} />
            ) : (
              <>
                <View style={styles.googleIconWrap}><Text style={styles.googleIconText}>G</Text></View>
                <Text style={styles.googleText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.linkRow}>
            <Text style={styles.linkText}>No account? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={[styles.linkText, styles.linkHighlight]}>Register</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  logoArea: { alignItems: 'center', marginBottom: 36 },
  tagline: { fontSize: 13, color: Colors.textSecondary, marginTop: 6 },

  card: {
    backgroundColor: Colors.surface, borderRadius: 20,
    padding: 24, borderWidth: 1, borderColor: Colors.border,
  },

  warnBanner: {
    backgroundColor: 'rgba(255,152,0,0.12)',
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  warnText: { color: Colors.warning, fontSize: 12, lineHeight: 17 },
  tabRow: {
    flexDirection: 'row', marginBottom: 20,
    backgroundColor: Colors.inputBg, borderRadius: 12, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },

  label: {
    color: Colors.textSecondary, fontSize: 12, fontWeight: '600',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6, marginTop: 14,
  },
  input: {
    backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
    color: Colors.text, fontSize: 16,
  },
  hint: { color: Colors.textMuted, fontSize: 11, marginTop: 5 },

  button: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 22, elevation: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textMuted, fontSize: 12, marginHorizontal: 12 },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceAlt, borderRadius: 12, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.border, gap: 10,
  },
  googleIconWrap: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#4285F4',
    justifyContent: 'center', alignItems: 'center',
  },
  googleIconText: { fontSize: 14, fontWeight: '900', color: '#fff' },
  googleText: { color: Colors.text, fontSize: 15, fontWeight: '600' },

  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  linkText: { color: Colors.textSecondary, fontSize: 14 },
  linkHighlight: { color: Colors.primaryLight, fontWeight: '600' },
});
