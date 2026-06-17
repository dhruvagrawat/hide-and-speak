import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { IS_DEMO } from '@/lib/demo';
import { AppLockProvider } from '@/lib/applock';
import { ThemeProvider } from '@/lib/theme';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { BrandSplash } from '@/components/BrandSplash';

export default function RootLayout() {
  // Demo mode skips the Supabase session check entirely and goes
  // straight into the app shell with canned data — see lib/demo.ts.
  const [session, setSession] = useState<Session | null | undefined>(
    IS_DEMO ? null : undefined,
  );

  useEffect(() => {
    if (IS_DEMO) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (IS_DEMO) {
      router.replace('/(app)/(tabs)');
      return;
    }
    if (session === undefined) return; // still loading
    if (session) {
      router.replace('/(app)/(tabs)');
    } else {
      router.replace('/(auth)/login');
    }
  }, [session]);

  if (session === undefined) {
    return <BrandSplash />;
  }

  const isAuthenticated = IS_DEMO || !!session;

  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="index" />
    </Stack>
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <StatusBar style="light" />
        {/* Only lock once there's actually something private to protect —
            no point gating the login/register screens behind biometrics. */}
        {isAuthenticated ? <AppLockProvider>{stack}</AppLockProvider> : stack}
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
