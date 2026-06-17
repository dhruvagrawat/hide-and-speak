import { Tabs } from 'expo-router';
import { Platform, type ColorValue } from 'react-native';
import { useTheme } from '@/lib/theme';
import { useFriendRequests } from '@/lib/friends';
import { Icon, type IconName } from '@/components/Icon';

/**
 * Bottom-tab shell for the main app: Chats · Status · Requests · Settings.
 * Each tab screen renders its own in-screen header, so the native header is
 * off here. Icons are clean line glyphs (Ionicons via the Icon wrapper) that
 * fill in when their tab is active and tint with the current theme.
 */
const tabIcon = (filled: IconName, outline: IconName) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Icon name={focused ? filled : outline} size={24} color={color} />
  );
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
          tabBarIcon: tabIcon('chat', 'chatOutline'),
        }}
      />
      <Tabs.Screen
        name="status"
        options={{
          title: 'Status',
          tabBarAccessibilityLabel: 'Status updates',
          tabBarIcon: tabIcon('status', 'statusOutline'),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Requests',
          tabBarAccessibilityLabel: 'Friend requests',
          tabBarBadge: incomingCount > 0 ? incomingCount : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.accent, fontSize: 10 },
          tabBarIcon: tabIcon('people', 'peopleOutline'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings',
          tabBarIcon: tabIcon('settings', 'settingsOutline'),
        }}
      />
    </Tabs>
  );
}
