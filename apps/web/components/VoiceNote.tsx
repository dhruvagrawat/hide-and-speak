'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Send, Play, Pause } from 'lucide-react';

function formatSeconds(total: number) {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface VoiceRecorderButtonProps {
  onRecorded: (blob: Blob, mimeType: string) => void;
}

export function VoiceRecorderButton({ onRecorded }: VoiceRecorderButtonProps) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setRecording(true);
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      alert('Allow microphone access to record voice notes.');
    }
  };

  const stopStream = () => {
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRecording(false);
  };

  const send = () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      onRecorded(blob, recorder.mimeType);
    };
    recorder.stop();
    stopStream();
  };

  const cancel = () => {
    recorderRef.current?.stop();
    stopStream();
  };

  if (recording) {
    return (
      <div className="flex h-[42px] items-center gap-2 rounded-[22px] bg-[#1A1A1A] px-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF6B8A]" />
        <span className="text-sm font-semibold text-[#F5F5F5]">{formatSeconds(seconds)}</span>
        <button onClick={cancel} className="px-2 text-xs text-[#9E9E9E] hover:text-[#F5F5F5]">
          Cancel
        </button>
        <button
          onClick={send}
          aria-label="Send voice note"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7C5CBF] text-white"
        >
          <Send size={15} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={start}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#9B7FD4] transition-colors hover:text-[#F5F5F5]"
      aria-label="Record voice note"
    >
      <Mic size={20} />
    </button>
  );
}

interface VoiceNoteBubbleProps {
  uri: string;
}

export function VoiceNoteBubble({ uri }: VoiceNoteBubbleProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
  };

  return (
    <div className="flex min-w-[170px] items-center gap-2 py-0.5">
      <audio
        ref={audioRef}
        src={uri}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
        className="hidden"
      />
      <button
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play'}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#9B7FD4] text-[#0D0D0D]"
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-[#9B7FD4]" style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="min-w-[32px] text-right text-[11px] text-[#9E9E9E]">
        {formatSeconds(Number.isFinite(duration) ? duration : 0)}
      </span>
    </div>
  );
}
