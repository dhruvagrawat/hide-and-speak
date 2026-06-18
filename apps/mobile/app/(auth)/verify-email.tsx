import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { LogoMark } from '@/components/Logo';
import { Icon } from '@/components/Icon';

/**
 * Shown right after an email signup when the account still needs confirming.
 * Gives a clear "check your inbox" message (instead of a fleeting alert that
 * surprised people), a resend button, and a path back to sign in.
 */
export default function VerifyEmail() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [resending, setResending] = useState(false);

  const resend = async () => {
    if (!email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
    Alert.alert(
      error ? 'Could not resend' : 'Sent',
      error ? error.message : `We re-sent the confirmation link to ${email}.`,
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#0D0D0D', '#1a0a2e', '#0D0D0D']} style={StyleSheet.absoluteFill} />
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Icon name="mail" size={34} color="#fff" />
        </View>
        <Text style={styles.title}>Confirm your email</Text>
        <Text style={styles.body}>
          We sent a confirmation link to{'\n'}
          <Text style={styles.email}>{email ?? 'your email'}</Text>.{'\n\n'}
          Tap the link in that email, then come back and sign in.
        </Text>

        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(auth)/login')} activeOpacity={0.85}>
          <Text style={styles.primaryText}>I’ve confirmed — Sign in</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={resend} disabled={resending} activeOpacity={0.85}>
          {resending ? (
            <ActivityIndicator color={Colors.primaryLight} />
          ) : (
            <Text style={styles.secondaryText}>Resend email</Text>
          )}
        </TouchableOpacity>

        <View style={styles.brand}>
          <LogoMark size={28} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 12 },
  body: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  email: { color: Colors.text, fontWeight: '700' },
  primaryBtn: {
    alignSelf: 'stretch', backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', elevation: 6,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 16, alignItems: 'center' },
  secondaryText: { color: Colors.primaryLight, fontSize: 15, fontWeight: '600' },
  brand: { position: 'absolute', bottom: 40, opacity: 0.5 },
});
