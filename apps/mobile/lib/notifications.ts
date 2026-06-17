import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Real OS notifications (the tray/heads-up kind), as opposed to the in-app
 * banner in NewMessageBanner. Privacy-first like the rest of the app: we only
 * ever say *who* messaged, never the content — matching the "notification
 * privacy" promise. Works in a dev/preview build; in Expo Go push is limited
 * but local notifications still fire on Android.
 */

const MESSAGES_CHANNEL = 'messages';
const CALLS_CHANNEL = 'calls';

let configured = false;
let permissionGranted: boolean | null = null;

/**
 * Show heads-up notifications even while the app is foregrounded — that's the
 * whole point of the Settings test button (you can see the real OS banner
 * without backgrounding the app).
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Register Android channels once. Safe to call repeatedly. */
async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(MESSAGES_CHANNEL, {
    name: 'Messages',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#7C3AED',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
  await Notifications.setNotificationChannelAsync(CALLS_CHANNEL, {
    name: 'Calls',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 500, 500],
    lightColor: '#7C3AED',
  });
}

/**
 * Ask for permission (Android 13+ shows the system prompt) and register
 * channels. Returns whether we're allowed to post. Caches the result so the
 * prompt only appears once.
 */
export async function ensureNotificationPermissions(): Promise<boolean> {
  if (!configured) {
    await ensureChannels();
    configured = true;
  }
  if (permissionGranted !== null) return permissionGranted;

  const settings = await Notifications.getPermissionsAsync();
  let status = settings.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  permissionGranted = status === 'granted';
  return permissionGranted;
}

/** Fire an immediate local notification. Resolves true if it was posted. */
async function present(
  channelId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<boolean> {
  const granted = await ensureNotificationPermissions();
  if (!granted) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data },
    // Android: deliver immediately on the given channel (heads-up importance).
    // iOS: a null trigger presents right away.
    trigger: Platform.OS === 'android' ? { channelId } : null,
  });
  return true;
}

/**
 * "New message" notification — name only, never the message text. Tapping it
 * routes via the `conversationId` we stash in `data` (handled by the response
 * listener in the root layout).
 */
export function notifyNewMessage(username: string, conversationId: string) {
  return present(
    MESSAGES_CHANNEL,
    'New message',
    `${username} sent you a message`,
    { type: 'message', conversationId },
  );
}

/** Incoming call notification (used by the call layer / demo test button). */
export function notifyIncomingCall(username: string, mode: 'voice' | 'video') {
  return present(
    CALLS_CHANNEL,
    `Incoming ${mode} call`,
    username,
    { type: 'call', mode },
  );
}
