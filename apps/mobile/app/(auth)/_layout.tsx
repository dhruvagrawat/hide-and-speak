import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="otp" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="verify-email" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
