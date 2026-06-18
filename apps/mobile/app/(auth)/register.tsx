import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { sendPhoneOtp } from '@/lib/auth';
import { Colors } from '@/constants/colors';
import { LogoMark, Wordmark } from '@/components/Logo';

type AuthTab = 'email' | 'phone';

/**
 * Single-auth registration. You verify ONE identifier and provide the other
 * as plain info we save to your profile (no second verification):
 *   • Email tab — verify email/password, optionally add a phone number.
 *   • Phone tab — verify phone via OTP, optionally add an email.
 * Email is the preferred/default method.
 */
export default function Register() {
  const [tab, setTab] = useState<AuthTab>('email');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

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

  // ── Register with email (phone optional, stored only) ──
  const handleEmailRegister = async () => {
    if (!backendReady()) return;
    if (!username.trim() || !email.trim() || !password || !confirm) {
      Alert.alert('Missing fields', 'Username, email and password are required.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    if (phone.trim() && !phone.trim().startsWith('+')) {
      Alert.alert('Invalid phone', 'Phone must start with + and country code, e.g. +919876543210.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          username: username.trim(),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
      },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Registration failed', error.message);
    } else {
      Alert.alert(
        'Almost there',
        'If email confirmation is on, tap the link we emailed you. Otherwise just sign in.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
      );
    }
  };

  // ── Register with phone (email optional, stored only) ──
  const handlePhoneRegister = async () => {
    if (!backendReady()) return;
    const p = phone.trim();
    if (!username.trim() || !p) {
      Alert.alert('Missing fields', 'Username and phone number are required.');
      return;
    }
    if (!p.startsWith('+')) {
      Alert.alert('Invalid phone', 'Phone must start with + and country code, e.g. +919876543210.');
      return;
    }
    setLoading(true);
    try {
      await sendPhoneOtp(p, {
        username: username.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      router.push({ pathname: '/(auth)/otp', params: { phone: p } });
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not send OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={['#0D0D0D', '#1a0a2e', '#0D0D0D']} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoArea}>
          <LogoMark size={68} style={{ marginBottom: 14 }} />
          <Wordmark size={26} />
          <Text style={styles.tagline}>Create your account</Text>
        </View>

        <View style={styles.card}>
          {/* Tab switcher */}
          <View style={styles.tabRow}>
            <TouchableOpacity style={[styles.tab, tab === 'email' && styles.tabActive]} onPress={() => setTab('email')}>
              <Text style={[styles.tabText, tab === 'email' && styles.tabTextActive]}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, tab === 'phone' && styles.tabActive]} onPress={() => setTab('phone')}>
              <Text style={[styles.tabText, tab === 'phone' && styles.tabTextActive]}>Phone</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="coolname42"
            placeholderTextColor={Colors.textMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {tab === 'email' ? (
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
                placeholder="Min 6 characters"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <Text style={styles.label}>Confirm password</Text>
              <TextInput
                style={styles.input}
                placeholder="Repeat password"
                placeholderTextColor={Colors.textMuted}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
              />
              <Text style={styles.label}>Phone <Text style={styles.optional}>· optional</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="+919876543210"
                placeholderTextColor={Colors.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCorrect={false}
              />
              <Text style={styles.hint}>Saved to your profile — not a second login.</Text>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleEmailRegister}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
              </TouchableOpacity>
            </>
          ) : (
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
              <Text style={styles.label}>Email <Text style={styles.optional}>· optional</Text></Text>
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
              <Text style={styles.hint}>We’ll text you a one-time code. Email is saved to your profile — not a second login.</Text>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handlePhoneRegister}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP via SMS</Text>}
              </TouchableOpacity>
            </>
          )}

          <View style={styles.linkRow}>
            <Text style={styles.linkText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={[styles.linkText, styles.linkHighlight]}>Sign In</Text>
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
  logoArea: { alignItems: 'center', marginBottom: 28 },
  tagline: { fontSize: 13, color: Colors.textSecondary, marginTop: 6 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabRow: {
    flexDirection: 'row', marginBottom: 6,
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
  optional: { color: Colors.textMuted, fontWeight: '500', textTransform: 'none', letterSpacing: 0 },
  input: {
    backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: Colors.text, fontSize: 16,
  },
  hint: { color: Colors.textMuted, fontSize: 11, marginTop: 6 },
  button: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 22, elevation: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  linkText: { color: Colors.textSecondary, fontSize: 14 },
  linkHighlight: { color: Colors.primaryLight, fontWeight: '600' },
});
