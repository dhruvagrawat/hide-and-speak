import { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '@/constants/colors';

/**
 * Skeleton — a shimmering placeholder block. A loading list of these reads
 * much calmer than a centred spinner, and hints at the shape of the content
 * that's about to arrive.
 */
export function Skeleton({ style }: { style?: ViewStyle }) {
  const shimmer = useSharedValue(0.4);
  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [shimmer]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: shimmer.value }));
  return <Animated.View style={[styles.base, style, animatedStyle]} />;
}

/** A row shaped like a conversation list item. */
export function ChatRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton style={styles.avatar} />
      <View style={styles.rowBody}>
        <Skeleton style={styles.line} />
        <Skeleton style={styles.lineShort} />
      </View>
    </View>
  );
}

/** A full list of conversation skeletons for the chat-list loading state. */
export function ChatListSkeleton({ count = 7 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <ChatRowSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: Colors.surfaceAlt, borderRadius: 8 },
  list: { paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 13 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  rowBody: { flex: 1, gap: 8 },
  line: { height: 14, borderRadius: 7, width: '45%' },
  lineShort: { height: 11, borderRadius: 6, width: '70%' },
});
