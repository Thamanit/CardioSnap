'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface EcgRecording {
  lead1: number[];
  lead2: number[];
  lead3: number[];
  timestamp: Date;
}

interface EcgContextType {
  recording: EcgRecording | null;
  isRecording: boolean;
  recordingDuration: number; // in seconds
  startRecording: () => void;
  stopRecording: () => void;
  clearRecording: () => void;
  addEcgSample: (lead: 'lead1' | 'lead2' | 'lead3', value: number) => void;
}

const EcgContext = createContext<EcgContextType | undefined>(undefined);

export function EcgProvider({ children }: { children: React.ReactNode }) {
  const [recording, setRecording] = useState<EcgRecording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = React.useRef<number | null>(null);

  const RECORDING_DURATION = 10; // seconds
  const SAMPLE_RATE = 125; // Hz

  const startRecording = useCallback(() => {
    setRecording({
      lead1: [],
      lead2: [],
      lead3: [],
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
    }, 10);
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

  const addEcgSample = useCallback((lead: 'lead1' | 'lead2' | 'lead3', value: number) => {
    if (!isRecording || !recording) return;

    // Check if we've reached the recording limit
    const maxSamples = SAMPLE_RATE * RECORDING_DURATION;
    if (recording[lead].length >= maxSamples) return;

    setRecording((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [lead]: [...prev[lead], value],
      };
    });
  }, [isRecording, recording]);

  const value: EcgContextType = {
    recording,
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    clearRecording,
    addEcgSample,
  };
  console.log(value)

  return <EcgContext.Provider value={value}>{children}</EcgContext.Provider>;
}

export function useEcgRecording() {
  const context = useContext(EcgContext);
  if (context === undefined) {
    throw new Error('useEcgRecording must be used within EcgProvider');
  }
  return context;
}
