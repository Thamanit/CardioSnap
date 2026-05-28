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
  startRecording: () => void;
  stopRecording: () => void;
  clearRecording: () => void;
  addMurmurSample: (value: number) => void;
}

const MurmurContext = createContext<MurmurContextType | undefined>(undefined);

// Constants outside component to prevent recalculation
const RECORDING_DURATION = 10; // seconds
const SAMPLE_RATE = 4000;
const MAX_SAMPLES = SAMPLE_RATE * RECORDING_DURATION; // 40,000

export function MurmurProvider({ children }: { children: React.ReactNode }) {
  const [recording, setRecording] = useState<MurmurRecording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const recordingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const autoStopTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = React.useRef<number | null>(null);
  const audioDataRef = React.useRef<number[]>([]);
  // Single source of truth for "am I recording right now" — no state lag
  const isRecordingRef = React.useRef(false);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) {
      console.log('[stopRecording] Already stopped, skipping');
      return;
    }
    
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
    const duration = (Date.now() - (startTimeRef.current ?? 0)) / 1000;
    
    console.log('===== [MURMUR RECORDING STOPPED] =====');
    console.log('Actual duration:', duration.toFixed(2), 'seconds');
    console.log('Captured samples:', captured.length);
    console.log('Expected samples:', RECORDING_DURATION * SAMPLE_RATE);
    console.log('Sample rate:', (captured.length / duration).toFixed(0), 'Hz');
    console.log('isRecordingRef.current:', isRecordingRef.current);
    
    setRecording({ audioData: captured, timestamp: new Date() });
  }, []);

  const startRecording = useCallback(() => {
    // Reset everything
    audioDataRef.current = [];
    isRecordingRef.current = true;
    setRecording(null);
    setIsRecording(true);
    setRecordingDuration(0);
    startTimeRef.current = Date.now();
    
    console.log('===== [MURMUR RECORDING START] =====');
    console.log('Start time:', new Date().toISOString());
    console.log('Expected duration: 10 seconds');
    console.log('Expected sample count: 40,000 (4000Hz × 10s)');
    console.log('isRecordingRef.current:', isRecordingRef.current);

    // Progress ticker — updates UI every 100 ms
    recordingIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - (startTimeRef.current ?? Date.now())) / 1000;
      const currentSamples = audioDataRef.current.length;
      setRecordingDuration(Math.min(elapsed, RECORDING_DURATION));
      
      if (elapsed % 1 < 0.15) { // Log roughly every second
        console.log(`[Progress] ${elapsed.toFixed(1)}s - Samples: ${currentSamples} (rate: ${(currentSamples / elapsed).toFixed(0)} Hz)`);
      }
    }, 100);

    // Hard stop after exactly 10 s
    autoStopTimerRef.current = setTimeout(() => {
      console.log('===== [AUTO-STOP TIMER FIRED] =====');
      console.log('Samples at stop:', audioDataRef.current.length);
      stopRecording();
    }, RECORDING_DURATION * 1000);
  }, [stopRecording]);

  const clearRecording = useCallback(() => {
    isRecordingRef.current = false;
    audioDataRef.current = [];
    setRecording(null);
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
    if (!isRecordingRef.current) {
      return;
    }
    if (audioDataRef.current.length >= MAX_SAMPLES) {
      if (audioDataRef.current.length === MAX_SAMPLES) {
        console.warn('⚠️ MAX_SAMPLES reached! Stopping capture at', MAX_SAMPLES, 'samples');
      }
      return;
    }
    audioDataRef.current.push(value);
  }, []);

  return (
    <MurmurContext.Provider
      value={{
        recording,
        isRecording,
        recordingDuration,
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