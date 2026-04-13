import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: Colors.background },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Hidea & Speak',
          headerRight: () => null,
        }}
      />
      <Stack.Screen
        name="chat/[id]"
        options={{ headerShown: true }}
      />
    </Stack>
  );
}
