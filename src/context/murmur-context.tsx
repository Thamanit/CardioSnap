'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface MurmurRecording {
  audioData: number[];
  timestamp: Date;
}

interface MurmurContextType {
  recording: MurmurRecording | null;
  isRecording: boolean;
  recordingDuration: number;
  ppgWavBlob: File | null;
  startRecording: () => void;
  stopRecording: () => void;
  clearRecording: () => void;
  addMurmurSample: (value: number) => void;
}

const MurmurContext = createContext<MurmurContextType | undefined>(undefined);

function encodeWav(samples: number[], sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (const s of samples) {
    const val = Math.max(-1, Math.min(1, s));
    view.setInt16(offset, val * 32767, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

export function MurmurProvider({ children }: { children: React.ReactNode }) {
  const [recording, setRecording] = useState<MurmurRecording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [ppgWavBlob, setPpgWavBlob] = useState<File | null>(null);

  const recordingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const autoStopTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = React.useRef<number | null>(null);
  const audioDataRef = React.useRef<number[]>([]);
  // Single source of truth for "am I recording right now" — no state lag
  const isRecordingRef = React.useRef(false);

  const RECORDING_DURATION = 10; // seconds
  const SAMPLE_RATE = 4000;
  const MAX_SAMPLES = SAMPLE_RATE * RECORDING_DURATION; // 40,000

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return; // already stopped
    isRecordingRef.current = false;
    setIsRecording(false);

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }

    const captured = [...audioDataRef.current];
    setRecording({ audioData: captured, timestamp: new Date() });

    if (captured.length > 0) {
      const wavBlob = encodeWav(captured, SAMPLE_RATE);
      const wavFile = new File([wavBlob], 'ppg_recording.wav', { type: 'audio/wav' });
      setPpgWavBlob(wavFile);
    }
  }, []);

  const startRecording = useCallback(() => {
    // Reset everything
    audioDataRef.current = [];
    isRecordingRef.current = true;
    setRecording(null);
    setPpgWavBlob(null);
    setIsRecording(true);
    setRecordingDuration(0);
    startTimeRef.current = Date.now();

    // Progress ticker — updates UI every 100 ms
    recordingIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - (startTimeRef.current ?? Date.now())) / 1000;
      setRecordingDuration(Math.min(elapsed, RECORDING_DURATION));
    }, 100);

    // Hard stop after exactly 10 s
    autoStopTimerRef.current = setTimeout(() => {
      stopRecording();
    }, RECORDING_DURATION * 1000);
  }, [stopRecording]);

  const clearRecording = useCallback(() => {
    isRecordingRef.current = false;
    audioDataRef.current = [];
    setRecording(null);
    setPpgWavBlob(null);
    setIsRecording(false);
    setRecordingDuration(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }, []);

  // Called from the sensor card on every incoming PCG sample.
  // Uses only refs — zero React overhead, zero stale-closure risk.
  const addMurmurSample = useCallback((value: number) => {
    if (!isRecordingRef.current) return;
    if (audioDataRef.current.length >= MAX_SAMPLES) return;
    audioDataRef.current.push(value);
  }, [MAX_SAMPLES]);

  return (
    <MurmurContext.Provider
      value={{
        recording,
        isRecording,
        recordingDuration,
        ppgWavBlob,
        startRecording,
        stopRecording,
        clearRecording,
        addMurmurSample,
      }}
    >
      {children}
    </MurmurContext.Provider>
  );
}

export function useMurmurRecording() {
  const context = useContext(MurmurContext);
  if (context === undefined) {
    throw new Error('useMurmurRecording must be used within MurmurProvider');
  }
  return context;
}