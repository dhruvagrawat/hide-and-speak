/**
 * Peer-to-peer image transport — sends an image directly device-to-device
 * over a WebRTC data channel, so it never touches Supabase Storage at all.
 * Only works when the recipient is online right now; if they're not,
 * there's nothing to connect to and the caller should fall back to the
 * normal server-stored upload (see chat/[id].tsx's sendImage).
 *
 * STATUS: not wired up yet. Real WebRTC needs `react-native-webrtc`, a
 * native module that — like push notifications — isn't available in
 * Expo Go. It needs a custom dev-client / EAS build to test. Until then,
 * this always reports `delivered: false` so callers cleanly fall back to
 * the existing server upload path instead of hanging or throwing.
 *
 * To make this real:
 *  1. `npx expo install react-native-webrtc` + a dev-client build.
 *  2. Use the existing per-conversation Supabase Realtime channel (already
 *     used for message inserts) to exchange SDP offer/answer + ICE
 *     candidates as broadcast events — that's your signaling channel,
 *     no extra server needed.
 *  3. Open an RTCDataChannel, stream the image bytes, ack on completion.
 */
export async function sendImageP2P(_args: {
  conversationId: string;
  recipientId: string;
  uri: string;
}): Promise<{ delivered: boolean }> {
  return { delivered: false };
}
