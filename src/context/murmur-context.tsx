'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface MurmurRecording {
  audioData: number[];
  timestamp: Date;
}

interface MurmurContextType {
  recording: MurmurRecording | null;
  isRecording: boolean;
  recordingDuration: number; // in seconds
  startRecording: () => void;
  stopRecording: () => void;
  clearRecording: () => void;
  addMurmurSample: (value: number) => void;
}

const MurmurContext = createContext<MurmurContextType | undefined>(undefined);

export function MurmurProvider({ children }: { children: React.ReactNode }) {
  const [recording, setRecording] = useState<MurmurRecording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = React.useRef<number | null>(null);

  const RECORDING_DURATION = 10; // seconds
  const SAMPLE_RATE = 4000; // Hz (PCG typical sample rate)

  const startRecording = useCallback(() => {
    setRecording({
      audioData: [],
      timestamp: new Date(),
    });
    setIsRecording(true);
    setRecordingDuration(0);
    startTimeRef.current = Date.now();

    // Update duration every 100ms
    recordingIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - (startTimeRef.current || Date.now())) / 1000;
      setRecordingDuration(Math.min(elapsed, RECORDING_DURATION));

      if (elapsed >= RECORDING_DURATION) {
        stopRecording();
      }
    }, 100);
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  const clearRecording = useCallback(() => {
    setRecording(null);
    setIsRecording(false);
    setRecordingDuration(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  const addMurmurSample = useCallback((value: number) => {
    if (!isRecording || !recording) return;

    // Check if we've reached the recording limit
    const maxSamples = SAMPLE_RATE * RECORDING_DURATION;
    if (recording.audioData.length >= maxSamples) return;

    setRecording((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        audioData: [...prev.audioData, value],
      };
    });
  }, [isRecording, recording]);

  const value: MurmurContextType = {
    recording,
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    clearRecording,
    addMurmurSample,
  };

  return <MurmurContext.Provider value={value}>{children}</MurmurContext.Provider>;
}

export function useMurmurRecording() {
  const context = useContext(MurmurContext);
  if (context === undefined) {
    throw new Error('useMurmurRecording must be used within MurmurProvider');
  }
  return context;
}
