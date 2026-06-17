import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';
import { PresenceProvider } from '@/lib/presence';
import { ActiveConversationProvider } from '@/lib/activeConversation';
import { NewMessageBanner } from '@/components/NewMessageBanner';

export default function AppLayout() {
  return (
    <PresenceProvider>
      <ActiveConversationProvider>
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
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="chat/[id]"
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="profile"
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <Stack.Screen
            name="gallery"
            options={{ headerShown: false, presentation: 'modal' }}
          />
        </Stack>
        <NewMessageBanner />
      </ActiveConversationProvider>
    </PresenceProvider>
  );
}
