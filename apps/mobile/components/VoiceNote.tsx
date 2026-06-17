import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import {
  useAudioRecorder,
  useAudioPlayer,
  useAudioPlayerStatus,
  RecordingPresets,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { Colors } from '@/constants/colors';
import { Icon } from '@/components/Icon';

function formatSeconds(total: number) {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// Record button — sits in the chat input bar
// ─────────────────────────────────────────────
interface VoiceRecorderButtonProps {
  onRecorded: (uri: string, durationSeconds: number) => void;
}

export function VoiceRecorderButton({ onRecorded }: VoiceRecorderButtonProps) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startRecording = async () => {
    const { status } = await requestRecordingPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow microphone access to record voice notes.');
      return;
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
    setSeconds(0);
    setRecording(true);
    intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stopAndSend = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    await recorder.stop();
    setRecording(false);
    if (recorder.uri) onRecorded(recorder.uri, seconds);
  };

  const cancel = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    await recorder.stop();
    setRecording(false);
  };

  if (recording) {
    return (
      <View style={styles.recordingBar}>
        <View style={styles.recDot} />
        <Text style={styles.recTime}>{formatSeconds(seconds)}</Text>
        <TouchableOpacity onPress={cancel} style={styles.recCancelBtn}>
          <Text style={styles.recCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={stopAndSend} style={styles.recSendBtn}>
          <Icon name="send" size={15} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.micBtn} onPress={startRecording} activeOpacity={0.7} accessibilityLabel="Record voice note">
      <Icon name="mic" size={22} color={Colors.primaryLight} />
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────
// Playback bubble — renders a message_type: 'voice_note'
// ─────────────────────────────────────────────
interface VoiceNoteBubbleProps {
  uri: string;
  isMine: boolean;
}

export function VoiceNoteBubble({ uri, isMine }: VoiceNoteBubbleProps) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const toggle = () => {
    if (status.playing) {
      player.pause();
    } else {
      if (status.didJustFinish) player.seekTo(0);
      player.play();
    }
  };

  const progress = status.duration > 0 ? Math.min(status.currentTime / status.duration, 1) : 0;
  const tint = isMine ? '#fff' : Colors.primaryLight;

  return (
    <TouchableOpacity style={styles.voiceRow} onPress={toggle} activeOpacity={0.8}>
      <View style={[styles.playBtn, { backgroundColor: tint }]}>
        <Icon name={status.playing ? 'pause' : 'play'} size={14} color={Colors.background} />
      </View>
      <View style={styles.waveTrack}>
        <View style={[styles.waveFill, { width: `${progress * 100}%`, backgroundColor: tint }]} />
      </View>
      <Text style={styles.voiceDuration}>{formatSeconds(status.duration || 0)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  micBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
  },

  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.inputBg,
    borderRadius: 22,
    paddingHorizontal: 12,
    height: 42,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent },
  recTime: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  recCancelBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  recCancelText: { color: Colors.textSecondary, fontSize: 13 },
  recSendBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },

  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 170, paddingVertical: 2 },
  playBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  waveTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  waveFill: { height: '100%', borderRadius: 2 },
  voiceDuration: { color: Colors.textSecondary, fontSize: 11, minWidth: 32, textAlign: 'right' },
});
