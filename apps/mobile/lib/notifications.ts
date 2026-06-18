import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

/**
 * Real OS notifications (the tray/heads-up kind), as opposed to the in-app
 * banner in NewMessageBanner. Privacy-first like the rest of the app: we only
 * ever say *who* messaged, never the content.
 *
 * Expo Go caveat: expo-notifications had its native push functionality
 * removed from Expo Go in SDK 53, so calling its APIs there throws. We detect
 * Expo Go and turn every function into a safe no-op — real notifications only
 * work (and are only needed) in a dev/preview build. Everything is also
 * wrapped in try/catch so a notification can never crash the app.
 */

// `appOwnership === 'expo'` is true only inside the Expo Go client; a
// dev/preview/standalone build reports null.
const isExpoGo = Constants.appOwnership === 'expo';

const MESSAGES_CHANNEL = 'messages';
const CALLS_CHANNEL = 'calls';

let configured = false;
let permissionGranted: boolean | null = null;

/** Set the foreground handler + Android channels, once. Never at import. */
async function configure() {
  if (configured || isExpoGo) return;
  configured = true;
  try {
    // Show heads-up notifications even while foregrounded — that's the point
    // of the Settings test button (you see the real OS banner immediately).
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
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
  } catch {
    // Native module unavailable (e.g. Expo Go) — stay a no-op.
  }
}

/**
 * Ask for permission and register channels. Returns whether we're allowed to
 * post. No-ops (returns false) in Expo Go. Caches the result so the system
 * prompt only appears once.
 */
export async function ensureNotificationPermissions(): Promise<boolean> {
  if (isExpoGo) return false;
  if (permissionGranted !== null) return permissionGranted;
  try {
    await configure();
    let status = (await Notifications.getPermissionsAsync()).status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    permissionGranted = status === 'granted';
  } catch {
    permissionGranted = false;
  }
  return permissionGranted;
}

/** Fire an immediate local notification. Resolves true if it was posted. */
async function present(
  channelId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<boolean> {
  if (isExpoGo) return false;
  try {
    const granted = await ensureNotificationPermissions();
    if (!granted) return false;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data },
      // Android: deliver immediately on the given channel (heads-up importance).
      // iOS: a null trigger presents right away.
      trigger: Platform.OS === 'android' ? { channelId } : null,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * "New message" notification — name only, never the message text. Tapping it
 * routes via the `conversationId` (see addNotificationTapHandler).
 */
export function notifyNewMessage(username: string, conversationId: string) {
  return present(MESSAGES_CHANNEL, 'New message', `${username} sent you a message`, {
    type: 'message',
    conversationId,
  });
}

/** Incoming call notification (used by the demo test button / call layer). */
export function notifyIncomingCall(username: string, mode: 'voice' | 'video') {
  return present(CALLS_CHANNEL, `Incoming ${mode} call`, username, { type: 'call', mode });
}

/**
 * Register a handler for taps on "new message" notifications (opens the chat).
 * Safe no-op in Expo Go. Returns an unsubscribe function.
 */
export function addNotificationTapHandler(
  onOpenConversation: (conversationId: string) => void,
): () => void {
  if (isExpoGo) return () => {};
  try {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { type?: string; conversationId?: string }
        | undefined;
      if (data?.type === 'message' && data.conversationId) {
        onOpenConversation(data.conversationId);
      }
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
