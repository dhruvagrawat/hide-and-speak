import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { AppState, AppStateStatus, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { BlurView } from 'expo-blur';
import { Colors } from '@/constants/colors';

const AppLockContext = createContext({ locked: false });

export function useAppLocked() {
  return useContext(AppLockContext).locked;
}

/**
 * Locks the whole app behind biometrics/device passcode whenever it comes
 * back from the background — same idea as WhatsApp's app lock. Wrap the
 * authenticated app shell with this; it renders a blocking overlay on top
 * of everything until the user re-authenticates.
 */
export function AppLockProvider({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [canAuthenticate, setCanAuthenticate] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then(async (hasHardware) => {
      const enrolled = hasHardware && (await LocalAuthentication.isEnrolledAsync());
      setCanAuthenticate(enrolled);
    });
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      const wasActive = appState.current === 'active';
      const goingBackground = next !== 'active';
      const cameBackToForeground = appState.current.match(/inactive|background/) && next === 'active';

      if (wasActive && goingBackground) {
        setLocked(true);
      }
      if (cameBackToForeground) {
        // setLocked(true) already happened on the way out — nothing else to do,
        // the overlay below stays up until authenticate() succeeds.
      }
      appState.current = next;
    });
    return () => subscription.remove();
  }, []);

  const authenticate = async () => {
    if (!canAuthenticate) {
      // No biometrics/passcode set up on this device — can't enforce a lock,
      // so don't trap the user behind a screen they can never get past.
      setLocked(false);
      return;
    }
    setAuthenticating(true);
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Hide & Speak',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });
    setAuthenticating(false);
    if (result.success) setLocked(false);
  };

  return (
    <AppLockContext.Provider value={{ locked }}>
      {children}
      {locked && (
        <View style={styles.overlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <Text style={styles.icon}>🔒</Text>
            </View>
            <Text style={styles.title}>Hide & Speak is locked</Text>
            <Text style={styles.subtitle}>
              {canAuthenticate
                ? 'Verify it’s you to keep chatting'
                : 'Set up a passcode or biometrics on this device to enable app lock'}
            </Text>
            <TouchableOpacity
              style={[styles.button, authenticating && styles.buttonDisabled]}
              onPress={authenticate}
              disabled={authenticating}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>
                {canAuthenticate ? '🔓 Unlock' : 'Continue'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </AppLockContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(13,13,13,0.6)',
  },
  content: { alignItems: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  icon: { fontSize: 32 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 28 },
  button: {
    backgroundColor: Colors.primary, borderRadius: 24, paddingHorizontal: 32,
    paddingVertical: 14, elevation: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
