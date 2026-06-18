import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Real OS notifications (the tray/heads-up kind), as opposed to the in-app
 * banner in NewMessageBanner. Privacy-first: we only ever say *who* messaged,
 * never the content.
 *
 * Expo Go caveat: expo-notifications had its native push module removed from
 * Expo Go in SDK 53, and *merely importing it there throws*. So we never
 * statically import it — it's pulled in with a dynamic import() that only runs
 * outside Expo Go. In Expo Go every function is a safe no-op; real
 * notifications work in a dev/preview build, where they're actually needed.
 */

// `appOwnership === 'expo'` is true only inside the Expo Go client; a
// dev/preview/standalone build reports null.
const isExpoGo = Constants.appOwnership === 'expo';

const MESSAGES_CHANNEL = 'messages';
const CALLS_CHANNEL = 'calls';

type NotificationsModule = typeof import('expo-notifications');

let modulePromise: Promise<NotificationsModule | null> | null = null;
let permissionGranted: boolean | null = null;

/**
 * Lazily load + configure expo-notifications. Returns null in Expo Go (or if
 * the native module is unavailable for any reason), so callers stay no-ops.
 * The dynamic import is what keeps Expo Go from ever evaluating the module.
 */
function getModule(): Promise<NotificationsModule | null> {
  if (isExpoGo) return Promise.resolve(null);
  if (!modulePromise) {
    modulePromise = import('expo-notifications')
      .then(async (Notifications) => {
        try {
          // Show heads-up notifications even while foregrounded — that's the
          // point of the Settings test button.
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
          // Configuration failed — still hand back the module; calls are guarded.
        }
        return Notifications;
      })
      .catch(() => null);
  }
  return modulePromise;
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
    const Notifications = await getModule();
    if (!Notifications) return (permissionGranted = false);
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
    const Notifications = await getModule();
    if (!Notifications) return false;
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
  let sub: { remove: () => void } | null = null;
  let cancelled = false;
  getModule().then((Notifications) => {
    if (!Notifications || cancelled) return;
    try {
      sub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as
          | { type?: string; conversationId?: string }
          | undefined;
        if (data?.type === 'message' && data.conversationId) {
          onOpenConversation(data.conversationId);
        }
      });
    } catch {
      // listener unavailable — ignore
    }
  });
  return () => {
    cancelled = true;
    sub?.remove();
  };
}
