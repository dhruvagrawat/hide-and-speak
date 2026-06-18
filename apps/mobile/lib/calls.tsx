import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { supabase } from './supabase';
import { IS_DEMO, DEMO_USER_ID } from './demo';
import { loadWebRTC, isCallMediaAvailable, ICE_SERVERS, WebRTCModule } from './webrtc';

export type CallMode = 'voice' | 'video';
export type CallStatus = 'outgoing' | 'incoming' | 'connected' | 'ended' | 'failed';

export interface CallPeer {
  id: string;
  name: string;
  avatar?: string | null;
}

export interface ActiveCall {
  id: string;
  mode: CallMode;
  status: CallStatus;
  peer: CallPeer;
  isCaller: boolean;
  /** Set when status is 'failed' — shown to the user (e.g. "Couldn't connect"). */
  error?: string;
}

/** How long an outgoing call rings before we give up and show "couldn't connect". */
const CONNECT_TIMEOUT_MS = 30_000;

interface CallContextValue {
  call: ActiveCall | null;
  /** True once we've confirmed live media (dev build); false = signaling-only. */
  mediaActive: boolean;
  muted: boolean;
  speakerOn: boolean;
  cameraOff: boolean;
  localStreamURL: string | null;
  remoteStreamURL: string | null;
  placeCall: (peer: CallPeer, mode: CallMode) => void;
  /** Demo-only: ring a fake incoming call to test the incoming UI. */
  simulateIncoming: (peer: CallPeer, mode: CallMode) => void;
  accept: () => void;
  end: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleCamera: () => void;
  switchCamera: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

const userChannelName = (userId: string) => `calls:user:${userId}`;
const callChannelName = (callId: string) => `call:${callId}`;

/**
 * CallProvider — voice & video calling over a thin Supabase Realtime
 * signaling layer, with react-native-webrtc carrying the actual media when
 * a dev build provides it (see lib/webrtc.ts). In Expo Go the call still
 * rings, connects and ends end-to-end; only the live audio/video is
 * stubbed until a native build.
 *
 * Signaling:
 *   • Each signed-in client subscribes to its personal channel
 *     `calls:user:<myId>` and listens for `invite`.
 *   • Once a call exists both parties join `call:<callId>` and exchange
 *     `accept` / `reject` / `end` and (when media is live) `offer`,
 *     `answer`, `ice`.
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [mediaActive, setMediaActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cameraOff, setCameraOff] = useState(false);
  const [localStreamURL, setLocalStreamURL] = useState<string | null>(null);
  const [remoteStreamURL, setRemoteStreamURL] = useState<string | null>(null);

  const myIdRef = useRef<string | null>(IS_DEMO ? DEMO_USER_ID : null);
  const callChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pcRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const rtcRef = useRef<WebRTCModule | null>(null);
  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Teardown ───────────────────────────────
  const cleanup = useCallback(() => {
    if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    demoTimerRef.current = null;
    if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
    connectTimerRef.current = null;
    try {
      localStreamRef.current?.getTracks?.().forEach((t: any) => t.stop());
    } catch {
      /* ignore */
    }
    localStreamRef.current = null;
    try {
      pcRef.current?.close?.();
    } catch {
      /* ignore */
    }
    pcRef.current = null;
    if (callChannelRef.current) {
      supabase.removeChannel(callChannelRef.current);
      callChannelRef.current = null;
    }
    setLocalStreamURL(null);
    setRemoteStreamURL(null);
    setMediaActive(false);
    setMuted(false);
    setCameraOff(false);
  }, []);

  const end = useCallback(() => {
    callChannelRef.current?.send({ type: 'broadcast', event: 'end', payload: {} });
    cleanup();
    setCall((c) => (c ? { ...c, status: 'ended' } : null));
    setTimeout(() => setCall(null), 250);
  }, [cleanup]);

  // Tear down media/signaling but keep a "failed" card up so the user sees
  // *why* (e.g. couldn't connect), then auto-dismiss.
  const failCall = useCallback(
    (message: string) => {
      cleanup();
      setCall((c) => (c && c.status !== 'connected' ? { ...c, status: 'failed', error: message } : c));
      setTimeout(() => setCall((c) => (c?.status === 'failed' ? null : c)), 3500);
    },
    [cleanup],
  );

  // ── Media setup (no-op when native module absent) ──
  const startMedia = useCallback(async (mode: CallMode, isCaller: boolean) => {
    const rtc = await loadWebRTC();
    if (!rtc) {
      setMediaActive(false);
      return null;
    }
    rtcRef.current = rtc;
    setMediaActive(true);

    const stream = await rtc.mediaDevices.getUserMedia({
      audio: true,
      video: mode === 'video' ? { facingMode: 'user' } : false,
    });
    localStreamRef.current = stream;
    setLocalStreamURL(stream.toURL());

    const pc = new rtc.RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;
    stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));

    pc.addEventListener('track', (e: any) => {
      if (e.streams && e.streams[0]) setRemoteStreamURL(e.streams[0].toURL());
    });
    pc.addEventListener('icecandidate', (e: any) => {
      if (e.candidate) {
        callChannelRef.current?.send({
          type: 'broadcast',
          event: 'ice',
          payload: { candidate: e.candidate },
        });
      }
    });

    if (isCaller) {
      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      callChannelRef.current?.send({ type: 'broadcast', event: 'offer', payload: { sdp: offer } });
    }
    return pc;
  }, []);

  // ── Per-call signaling channel ─────────────
  const joinCallChannel = useCallback(
    (callId: string) => {
      const channel = supabase.channel(callChannelName(callId));
      callChannelRef.current = channel;

      channel
        .on('broadcast', { event: 'accept' }, () => {
          if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
          connectTimerRef.current = null;
          setCall((c) => (c ? { ...c, status: 'connected' } : c));
        })
        .on('broadcast', { event: 'reject' }, () => end())
        .on('broadcast', { event: 'end' }, () => {
          cleanup();
          setCall((c) => (c ? { ...c, status: 'ended' } : null));
          setTimeout(() => setCall(null), 250);
        })
        .on('broadcast', { event: 'offer' }, async ({ payload }) => {
          const rtc = rtcRef.current;
          const pc = pcRef.current;
          if (!rtc || !pc) return;
          await pc.setRemoteDescription(new rtc.RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({ type: 'broadcast', event: 'answer', payload: { sdp: answer } });
        })
        .on('broadcast', { event: 'answer' }, async ({ payload }) => {
          const rtc = rtcRef.current;
          const pc = pcRef.current;
          if (!rtc || !pc) return;
          await pc.setRemoteDescription(new rtc.RTCSessionDescription(payload.sdp));
        })
        .on('broadcast', { event: 'ice' }, async ({ payload }) => {
          const rtc = rtcRef.current;
          const pc = pcRef.current;
          if (!rtc || !pc || !payload.candidate) return;
          try {
            await pc.addIceCandidate(new rtc.RTCIceCandidate(payload.candidate));
          } catch {
            /* ignore late candidates */
          }
        })
        .subscribe();

      return channel;
    },
    [cleanup, end],
  );

  // ── Place an outgoing call ─────────────────
  const placeCall = useCallback(
    (peer: CallPeer, mode: CallMode) => {
      const myId = myIdRef.current ?? DEMO_USER_ID;
      const callId = `${myId}__${Date.now()}`;
      setCall({ id: callId, mode, status: 'outgoing', peer, isCaller: true });

      if (IS_DEMO) {
        // No real peer to ring — simulate them picking up so the in-call
        // screen is reachable for demoing the flow.
        isCallMediaAvailable().then(setMediaActive);
        demoTimerRef.current = setTimeout(() => {
          setCall((c) => (c ? { ...c, status: 'connected' } : c));
        }, 1800);
        return;
      }

      joinCallChannel(callId);
      // Invite the recipient on their personal channel.
      const invite = supabase.channel(userChannelName(peer.id));
      invite.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          invite.send({
            type: 'broadcast',
            event: 'invite',
            payload: {
              callId,
              mode,
              from: { id: myId, name: '', avatar: null },
            },
          });
          supabase.removeChannel(invite);
        }
      });
      // Media is best-effort (signaling-only is fine); never let it crash the call.
      startMedia(mode, true).catch(() => setMediaActive(false));
      // Give up if they never answer.
      connectTimerRef.current = setTimeout(() => {
        failCall(`${peer.name || 'They'} didn’t answer — couldn’t connect.`);
      }, CONNECT_TIMEOUT_MS);
    },
    [joinCallChannel, startMedia, failCall],
  );

  // ── Demo-only: simulate an incoming call ───
  const simulateIncoming = useCallback((peer: CallPeer, mode: CallMode) => {
    setCall({ id: `incoming__${Date.now()}`, mode, status: 'incoming', peer, isCaller: false });
  }, []);

  // ── Accept an incoming call ────────────────
  const accept = useCallback(() => {
    setCall((c) => (c ? { ...c, status: 'connected' } : c));
    if (IS_DEMO) {
      isCallMediaAvailable().then(setMediaActive);
      return;
    }
    callChannelRef.current?.send({ type: 'broadcast', event: 'accept', payload: {} });
    if (call) startMedia(call.mode, false);
  }, [call, startMedia]);

  // ── Controls ───────────────────────────────
  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      localStreamRef.current?.getAudioTracks?.().forEach((t: any) => (t.enabled = !next));
      return next;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    setCameraOff((off) => {
      const next = !off;
      localStreamRef.current?.getVideoTracks?.().forEach((t: any) => (t.enabled = !next));
      return next;
    });
  }, []);

  const switchCamera = useCallback(() => {
    localStreamRef.current?.getVideoTracks?.().forEach((t: any) => t._switchCamera?.());
  }, []);

  const toggleSpeaker = useCallback(() => setSpeakerOn((s) => !s), []);

  // ── Listen for incoming calls on my personal channel ──
  useEffect(() => {
    if (IS_DEMO) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      myIdRef.current = user.id;

      channel = supabase.channel(userChannelName(user.id));
      channel
        .on('broadcast', { event: 'invite' }, async ({ payload }) => {
          // Don't interrupt a call already in progress.
          setCall((existing) => {
            if (existing) return existing;
            return {
              id: payload.callId,
              mode: payload.mode as CallMode,
              status: 'incoming',
              peer: { id: payload.from.id, name: payload.from.name || 'Incoming call', avatar: payload.from.avatar },
              isCaller: false,
            };
          });
          // Enrich caller name from profiles.
          const { data } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', payload.from.id)
            .single();
          if (data) {
            setCall((c) =>
              c && c.id === payload.callId
                ? { ...c, peer: { ...c.peer, name: data.username, avatar: data.avatar_url } }
                : c,
            );
          }
          joinCallChannel(payload.callId);
        })
        .subscribe();
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [joinCallChannel]);

  useEffect(() => cleanup, [cleanup]);

  return (
    <CallContext.Provider
      value={{
        call,
        mediaActive,
        muted,
        speakerOn,
        cameraOff,
        localStreamURL,
        remoteStreamURL,
        placeCall,
        simulateIncoming,
        accept,
        end,
        toggleMute,
        toggleSpeaker,
        toggleCamera,
        switchCamera,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCalls(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCalls must be used within a CallProvider');
  return ctx;
}
