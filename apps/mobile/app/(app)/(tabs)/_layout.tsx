import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useTheme } from '@/lib/theme';
import { useFriendRequests } from '@/lib/friends';
import { PixelIcon } from '@/components/PixelIcon';

/**
 * Bottom-tab shell for the main app: Chats · Status · Requests · Settings.
 * Each tab screen renders its own in-screen header, so the native header is
 * off here. Icons are crisp pixel-art glyphs (see PixelIcon) that tint with
 * the active theme.
 */
export default function TabsLayout() {
  const Colors = useTheme();
  const { incomingCount } = useFriendRequests();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: Colors.background },
        tabBarActiveTintColor: Colors.primaryLight,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: Platform.OS === 'ios' ? 86 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chats',
          tabBarAccessibilityLabel: 'Chats',
          tabBarIcon: ({ color }) => <PixelIcon name="chat" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="status"
        options={{
          title: 'Status',
          tabBarAccessibilityLabel: 'Status updates',
          tabBarIcon: ({ color }) => <PixelIcon name="status" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Requests',
          tabBarAccessibilityLabel: 'Friend requests',
          tabBarBadge: incomingCount > 0 ? incomingCount : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.accent, fontSize: 10 },
          tabBarIcon: ({ color }) => <PixelIcon name="people" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings',
          tabBarIcon: ({ color }) => <PixelIcon name="gear" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
