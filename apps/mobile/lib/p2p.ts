/**
 * Peer-to-peer image transport — sends an image directly device-to-device
 * over a WebRTC data channel, so it never touches Supabase Storage at all.
 * Only works when the recipient is online right now; if they're not,
 * there's nothing to connect to and the caller should fall back to the
 * normal server-stored upload (see chat/[id].tsx's sendImage).
 *
 * STATUS:
 *  • Demo mode — simulates a direct device-to-device handshake (a short
 *    "connecting…" delay) and reports `delivered: true`, so you can see the
 *    whole P2P send flow end-to-end on a single device.
 *  • Real mode — real WebRTC needs `react-native-webrtc`, a native module
 *    that (like push) isn't in Expo Go; it needs a dev-client / EAS build.
 *    Until that's wired, this reports `delivered: false` so callers cleanly
 *    fall back to the existing server upload path instead of hanging.
 *
 * To make real mode work:
 *  1. react-native-webrtc is already installed; build a dev/preview client.
 *  2. Use the existing per-conversation Supabase Realtime channel (already
 *     used for message inserts) to exchange SDP offer/answer + ICE
 *     candidates as broadcast events — that's your signaling channel,
 *     no extra server needed.
 *  3. Open an RTCDataChannel, stream the image bytes, ack on completion.
 */
import { IS_DEMO } from './demo';

export async function sendImageP2P(_args: {
  conversationId: string;
  recipientId: string;
  uri: string;
}): Promise<{ delivered: boolean }> {
  if (IS_DEMO) {
    // Simulate the direct handshake + transfer so the flow is demoable.
    await new Promise((resolve) => setTimeout(resolve, 700));
    return { delivered: true };
  }
  return { delivered: false };
}
