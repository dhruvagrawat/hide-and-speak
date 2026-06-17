import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { Colors } from '@/constants/colors';
import { Avatar } from '@/components/Avatar';
import { ScalePressable } from '@/components/AnimatedPressable';
import { useCalls } from '@/lib/calls';
import { loadWebRTC } from '@/lib/webrtc';

/**
 * CallOverlay — the full-screen voice/video call UI. Mounted once near the
 * app root; renders only when there's an active call. Reads everything from
 * the CallProvider (lib/calls.tsx). When live media is available it shows
 * the remote video full-bleed with a local PIP; otherwise it shows the
 * peer's avatar over the brand gradient and a note that media needs a build.
 */
export function CallOverlay() {
  const {
    call,
    mediaActive,
    muted,
    speakerOn,
    cameraOff,
    localStreamURL,
    remoteStreamURL,
    accept,
    end,
    toggleMute,
    toggleSpeaker,
    toggleCamera,
    switchCamera,
  } = useCalls();

  // RTCView only exists in a dev build — load it lazily so Expo Go is fine.
  const [RTCView, setRTCView] = useState<React.ComponentType<any> | null>(null);
  useEffect(() => {
    if (mediaActive) loadWebRTC().then((m) => setRTCView(() => m?.RTCView ?? null));
  }, [mediaActive]);

  // Elapsed timer once connected.
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (call?.status !== 'connected') {
      setSeconds(0);
      return;
    }
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [call?.status]);

  if (!call) return null;

  const isVideo = call.mode === 'video';
  const showRemoteVideo = isVideo && mediaActive && remoteStreamURL && RTCView && call.status === 'connected';
  const showLocalVideo = isVideo && mediaActive && localStreamURL && RTCView && !cameraOff;

  const statusLabel =
    call.status === 'outgoing'
      ? 'Calling…'
      : call.status === 'incoming'
        ? `Incoming ${isVideo ? 'video' : 'voice'} call`
        : call.status === 'connected'
          ? formatDuration(seconds)
          : 'Call ended';

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <View style={styles.fill}>
        {/* Background: remote video, else brand gradient */}
        {showRemoteVideo ? (
          <RTCView streamURL={remoteStreamURL!} style={StyleSheet.absoluteFill} objectFit="cover" />
        ) : (
          <LinearGradient colors={Colors.heroGradient} style={StyleSheet.absoluteFill} />
        )}

        {/* Local PIP */}
        {showLocalVideo && (
          <View style={styles.pip}>
            <RTCView streamURL={localStreamURL!} style={styles.pipVideo} objectFit="cover" mirror zOrder={1} />
          </View>
        )}

        {/* Peer identity */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.identity}>
          {!showRemoteVideo && (
            <Avatar username={call.peer.name} avatarUrl={call.peer.avatar} size={120} />
          )}
          <Text style={styles.name}>{call.peer.name}</Text>
          <Text style={styles.status}>{statusLabel}</Text>
          {!mediaActive && call.status === 'connected' && (
            <Text style={styles.mediaNote}>
              Live {isVideo ? 'video' : 'audio'} needs a dev build — call flow is simulated here.
            </Text>
          )}
        </Animated.View>

        {/* Controls */}
        <Animated.View entering={FadeInUp.duration(400)} style={styles.controls}>
          {call.status === 'incoming' ? (
            <View style={styles.incomingRow}>
              <CallButton color={Colors.error} icon="✕" label="Decline" onPress={end} />
              <CallButton color={Colors.success} icon="✓" label="Accept" onPress={accept} />
            </View>
          ) : (
            <>
              <View style={styles.controlRow}>
                <CallButton
                  color={muted ? Colors.text : 'rgba(255,255,255,0.18)'}
                  textColor={muted ? Colors.background : '#fff'}
                  icon={muted ? '🔇' : '🎙'}
                  label={muted ? 'Unmute' : 'Mute'}
                  onPress={toggleMute}
                />
                {isVideo ? (
                  <CallButton
                    color="rgba(255,255,255,0.18)"
                    icon={cameraOff ? '📷' : '🎥'}
                    label={cameraOff ? 'Camera on' : 'Camera off'}
                    onPress={toggleCamera}
                  />
                ) : (
                  <CallButton
                    color={speakerOn ? 'rgba(255,255,255,0.18)' : Colors.text}
                    textColor={speakerOn ? '#fff' : Colors.background}
                    icon="🔊"
                    label="Speaker"
                    onPress={toggleSpeaker}
                  />
                )}
                {isVideo && (
                  <CallButton color="rgba(255,255,255,0.18)" icon="🔄" label="Flip" onPress={switchCamera} />
                )}
              </View>
              <View style={styles.endRow}>
                <CallButton color={Colors.error} icon="📞" label="End" onPress={end} big />
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function CallButton({
  color,
  textColor = '#fff',
  icon,
  label,
  onPress,
  big,
}: {
  color: string;
  textColor?: string;
  icon: string;
  label: string;
  onPress: () => void;
  big?: boolean;
}) {
  return (
    <View style={styles.btnWrap}>
      <ScalePressable
        onPress={onPress}
        style={[styles.btn, big && styles.btnBig, { backgroundColor: color }]}
      >
        <Text style={[styles.btnIcon, big && styles.btnIconBig, { color: textColor }]}>{icon}</Text>
      </ScalePressable>
      <Text style={styles.btnLabel}>{label}</Text>
    </View>
  );
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: Colors.background },
  identity: { position: 'absolute', top: '20%', left: 0, right: 0, alignItems: 'center', gap: 14 },
  name: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 6 },
  status: { color: 'rgba(255,255,255,0.75)', fontSize: 16 },
  mediaNote: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginTop: 8,
  },

  pip: {
    position: 'absolute',
    top: 56,
    right: 16,
    width: 104,
    height: 150,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: Colors.surface,
  },
  pipVideo: { flex: 1 },

  controls: { position: 'absolute', bottom: 56, left: 0, right: 0, gap: 28 },
  controlRow: { flexDirection: 'row', justifyContent: 'center', gap: 28 },
  incomingRow: { flexDirection: 'row', justifyContent: 'space-evenly' },
  endRow: { alignItems: 'center' },

  btnWrap: { alignItems: 'center', gap: 8 },
  btn: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  btnBig: { width: 72, height: 72, borderRadius: 36 },
  btnIcon: { fontSize: 24 },
  btnIconBig: { fontSize: 30, transform: [{ rotate: '135deg' }] },
  btnLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
});
