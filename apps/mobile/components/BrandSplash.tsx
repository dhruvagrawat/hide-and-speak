import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '@/constants/colors';

/**
 * BrandSplash — the animated "Hide & Speak" loading screen.
 *
 * Used both as the JS-side splash (while the auth session is resolving in
 * the root layout) and anywhere a full-screen branded loading state reads
 * better than a bare spinner. The native splash (expo-splash-screen) is a
 * static image; this is the animated handoff that follows it so the launch
 * never feels like it snapped to a blank loader.
 */
export function BrandSplash({ tagline = 'Private. Hidden. Yours.' }: { tagline?: string }) {
  const logoScale = useSharedValue(0.7);
  const logoOpacity = useSharedValue(0);
  const ringScale = useSharedValue(1);
  const taglineOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) });
    logoScale.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.back(1.4)) });
    taglineOpacity.value = withDelay(350, withTiming(1, { duration: 500 }));
    // Soft breathing halo behind the mark.
    ringScale.value = withRepeat(
      withTiming(1.18, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [logoOpacity, logoScale, taglineOpacity, ringScale]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value * 0.4,
    transform: [{ scale: ringScale.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));

  return (
    <LinearGradient colors={Colors.heroGradient} style={styles.fill}>
      <View style={styles.center}>
        <View style={styles.markWrap}>
          <Animated.View style={[styles.halo, ringStyle]} />
          <Animated.View style={logoStyle}>
            <LinearGradient colors={Colors.fabGradient} style={styles.mark}>
              <Text style={styles.markGlyph}>🔒</Text>
            </LinearGradient>
          </Animated.View>
        </View>

        <Animated.View style={logoStyle}>
          <Text style={styles.title}>Hide & Speak</Text>
        </Animated.View>

        <Animated.Text style={[styles.tagline, taglineStyle]}>{tagline}</Animated.Text>
      </View>

      <View style={styles.dotsWrap}>
        <PulseDots />
      </View>
    </LinearGradient>
  );
}

/** Three dots that pulse in sequence — the "still loading" affordance. */
function PulseDots() {
  return (
    <View style={styles.dotsRow}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 180} />
      ))}
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const v = useSharedValue(0.3);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
  }, [delay, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.7 + v.value * 0.3 }] }));
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  center: { alignItems: 'center' },
  markWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  halo: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primaryLight,
  },
  mark: {
    width: 92,
    height: 92,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  markGlyph: { fontSize: 44 },
  title: { fontSize: 30, fontWeight: '800', color: Colors.text, letterSpacing: 0.5 },
  tagline: { fontSize: 14, color: Colors.textSecondary, marginTop: 8, letterSpacing: 0.3 },
  dotsWrap: { position: 'absolute', bottom: 64 },
  dotsRow: { flexDirection: 'row', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.primaryLight },
});
