/**
 * WebRTC media engine wrapper.
 *
 * `react-native-webrtc` is a native module — it only works in a custom
 * dev-client / EAS build, never in plain Expo Go (same constraint as the
 * P2P image send in lib/p2p.ts). Everything here is written so that when
 * the native module is absent we fail soft: `loadWebRTC()` returns null,
 * `isCallMediaAvailable()` is false, and the call UI runs in
 * "signaling-only" mode (the call still rings/connects/ends over Supabase
 * Realtime, there's just no live audio/video until a real build).
 *
 * To enable real media:
 *   1. The dependency + config plugin are already wired (package.json /
 *      app.json). Run `npx expo prebuild` then `npx expo run:android`
 *      (or an EAS dev build).
 *   2. Nothing else changes — this module and lib/calls.tsx detect the
 *      native module at runtime and light up automatically.
 */

// Cached module handle: `undefined` = not probed yet, `null` = unavailable.
let cached: unknown | undefined;

export interface WebRTCModule {
  RTCPeerConnection: new (config: object) => any;
  RTCIceCandidate: new (init: object) => any;
  RTCSessionDescription: new (init: object) => any;
  mediaDevices: { getUserMedia: (constraints: object) => Promise<any> };
  RTCView: React.ComponentType<{ streamURL: string; style?: object; objectFit?: string; mirror?: boolean; zOrder?: number }>;
}

/** Lazily load + probe react-native-webrtc. Returns null in Expo Go. */
export async function loadWebRTC(): Promise<WebRTCModule | null> {
  if (cached !== undefined) return cached as WebRTCModule | null;
  try {
    const mod = (await import('react-native-webrtc')) as unknown as WebRTCModule;
    // Probe: constructing a peer connection touches the native module and
    // throws if it isn't registered (i.e. we're in Expo Go).
    const pc = new mod.RTCPeerConnection({});
    pc.close();
    cached = mod;
  } catch {
    cached = null;
  }
  return cached as WebRTCModule | null;
}

export async function isCallMediaAvailable(): Promise<boolean> {
  return (await loadWebRTC()) !== null;
}

/** Public STUN servers — enough for most NATs. A production app should add
 * a TURN server for symmetric-NAT fallback (see SUPABASE_SETUP.md). */
export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};
