import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';
import { PresenceProvider } from '@/lib/presence';
import { ActiveConversationProvider } from '@/lib/activeConversation';
import { CallProvider } from '@/lib/calls';
import { FriendsProvider } from '@/lib/friends';
import { NewMessageBanner } from '@/components/NewMessageBanner';
import { CallOverlay } from '@/components/CallOverlay';

export default function AppLayout() {
  return (
    <PresenceProvider>
      <FriendsProvider>
        <CallProvider>
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
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="chat/[id]" options={{ headerShown: true }} />
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
            <CallOverlay />
          </ActiveConversationProvider>
        </CallProvider>
      </FriendsProvider>
    </PresenceProvider>
  );
}
