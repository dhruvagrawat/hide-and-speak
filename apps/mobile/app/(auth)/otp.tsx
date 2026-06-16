import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { verifyPhoneOtp, sendPhoneOtp } from '@/lib/auth';
import { Colors } from '@/constants/colors';

const OTP_LENGTH = 6;

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleChange = (value: string, index: number) => {
    // Accept only digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are filled
    if (next.every(Boolean) && next.join('').length === OTP_LENGTH) {
      handleVerify(next.join(''));
    }
  };

  const handleKeyPress = (e: { nativeEvent: { key: string } }, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code?: string) => {
    const token = code ?? otp.join('');
    if (token.length < OTP_LENGTH) {
      Alert.alert('Incomplete code', 'Please enter the full 6-digit code.');
      return;
    }
    if (!phone) return;

    setLoading(true);
    try {
      await verifyPhoneOtp(phone, token);
      // onAuthStateChange in _layout.tsx handles navigation
    } catch (e: unknown) {
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      Alert.alert('Invalid code', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!phone) return;
    setResending(true);
    try {
      await sendPhoneOtp(phone);
      Alert.alert('Code sent', `A new OTP was sent to ${phone}`);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not resend OTP.');
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient colors={['#0D0D0D', '#1a0a2e', '#0D0D0D']} style={StyleSheet.absoluteFill} />

      <View style={styles.container}>
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>💬</Text>
          </View>
          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.phoneHighlight}>{phone}</Text>
          </Text>

          {/* 6-box OTP input */}
          <View style={styles.otpRow}>
            {otp.map((digit, i) => (
              <TextInput
                key={i}
                ref={(r) => { inputRefs.current[i] = r; }}
                style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                value={digit}
                onChangeText={(v) => handleChange(v, i)}
                onKeyPress={(e) => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                caretHidden
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.verifyBtn, (loading || otp.join('').length < OTP_LENGTH) && styles.btnDisabled]}
            onPress={() => handleVerify()}
            disabled={loading || otp.join('').length < OTP_LENGTH}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.verifyText}>Verify</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resendBtn}
            onPress={handleResend}
            disabled={resending}
          >
            {resending
              ? <ActivityIndicator color={Colors.primaryLight} size="small" />
              : <Text style={styles.resendText}>Didn&apos;t get it? Resend code</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { padding: 20, paddingBottom: 0 },
  backText: { color: Colors.textSecondary, fontSize: 15 },

  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  iconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
    borderWidth: 1, borderColor: Colors.border,
  },
  iconText: { fontSize: 36 },

  title: { fontSize: 28, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 36 },
  phoneHighlight: { color: Colors.primaryLight, fontWeight: '600' },

  otpRow: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  otpBox: {
    width: 46, height: 58, borderRadius: 12,
    backgroundColor: Colors.inputBg, borderWidth: 1.5, borderColor: Colors.border,
    color: Colors.text, fontSize: 24, fontWeight: '700',
    textAlign: 'center',
  },
  otpBoxFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryDark },

  verifyBtn: {
    width: '100%', backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', elevation: 6, marginBottom: 16,
  },
  btnDisabled: { opacity: 0.5 },
  verifyText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  resendBtn: { paddingVertical: 10 },
  resendText: { color: Colors.primaryLight, fontSize: 14, fontWeight: '500' },
});
