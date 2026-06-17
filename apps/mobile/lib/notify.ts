/**
 * Tiny in-process event hub for the in-app "new message" banner.
 *
 * Normally the banner is driven by Supabase Realtime INSERTs (see
 * NewMessageBanner). In demo mode there's no second device, so the Settings
 * → "Demo & testing" panel uses `triggerDemoBanner()` to fire the exact same
 * banner manually — letting you see/test the notification-privacy UX
 * ("New message from X", no content) without a backend.
 */
export interface DemoBannerPayload {
  conversationId: string;
  username: string;
}

type Listener = (payload: DemoBannerPayload) => void;

const listeners = new Set<Listener>();

export function onDemoBanner(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function triggerDemoBanner(payload: DemoBannerPayload): void {
  listeners.forEach((l) => l(payload));
}
