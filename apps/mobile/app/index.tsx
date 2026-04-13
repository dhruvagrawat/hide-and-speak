import { View, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/colors';

// Root index: _layout.tsx handles the redirect based on auth state.
// This screen is only briefly visible during the initial session check.
export default function Index() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
      <ActivityIndicator color={Colors.primary} size="large" />
    </View>
  );
}
