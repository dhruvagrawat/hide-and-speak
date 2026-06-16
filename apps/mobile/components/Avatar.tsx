import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '@/constants/colors';

interface AvatarProps {
  username: string | null | undefined;
  avatarUrl?: string | null;
  size?: number;
}

/**
 * Profile picture if one's set, otherwise the same initials-circle
 * fallback used everywhere before avatars existed — so nothing looks
 * broken for users who haven't uploaded a photo yet.
 */
export function Avatar({ username, avatarUrl, size = 48 }: AvatarProps) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={[styles.image, dimension]} contentFit="cover" />;
  }

  return (
    <View style={[styles.fallback, dimension]}>
      <Text style={[styles.letter, { fontSize: size * 0.42 }]}>
        {(username ?? '?')[0]?.toUpperCase() ?? '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: Colors.surfaceAlt },
  fallback: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  letter: { color: '#fff', fontWeight: '700' },
});
