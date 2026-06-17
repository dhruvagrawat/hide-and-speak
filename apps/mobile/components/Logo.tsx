import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';

/**
 * The Hide & Speak brand mark — built entirely in code so it's crisp at any
 * size, themeable, and version-controlled (no PNG to redraw). It's a speech
 * bubble ("speak") with a keyhole punched through it ("hide"): privacy +
 * messaging in one glyph. Brand colours are intentionally constant across
 * app themes, the way a real logo stays put.
 */
export function LogoMark({ size = 92, style }: { size?: number; style?: ViewStyle }) {
  const radius = size * 0.28;
  const bubble = size * 0.66;
  const holeD = size * 0.15;
  const stemW = size * 0.055;
  const stemH = size * 0.13;

  return (
    <LinearGradient
      colors={Colors.fabGradient}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Ionicons name="chatbubble" size={bubble} color="rgba(255,255,255,0.96)" />
      {/* Keyhole punched through the bubble, in the bubble's shadow tone. */}
      <View style={[styles.keyhole, { transform: [{ translateY: -size * 0.04 }] }]} pointerEvents="none">
        <View style={{ width: holeD, height: holeD, borderRadius: holeD / 2, backgroundColor: Colors.primaryDark }} />
        <View style={{ width: stemW, height: stemH, marginTop: -holeD * 0.12, backgroundColor: Colors.primaryDark, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
      </View>
    </LinearGradient>
  );
}

/** The wordmark — "Hide & Speak" with the ampersand in the accent colour. */
export function Wordmark({ size = 30, color = Colors.text }: { size?: number; color?: string }) {
  return (
    <Text style={[styles.word, { fontSize: size, color }]}>
      Hide <Text style={{ color: Colors.accent }}>&</Text> Speak
    </Text>
  );
}

const styles = StyleSheet.create({
  keyhole: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  word: { fontWeight: '800', letterSpacing: 0.5 },
});
