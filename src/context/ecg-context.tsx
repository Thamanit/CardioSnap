'use client';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface EcgRecording {
  lead1: number[];
  lead2: number[];
  lead3: number[];
  timestamp: Date;
}

interface EcgContextType {
  recording: EcgRecording | null;
  isRecording: boolean;
  recordingDuration: number;
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
  const pendingRef = React.useRef<{ lead1: number[]; lead2: number[]; lead3: number[] }>({
    lead1: [], lead2: [], lead3: []
  });
  const sampleCountsRef = React.useRef({ lead1: 0, lead2: 0, lead3: 0 });

  const RECORDING_DURATION = 10;
  const SAMPLE_RATE = 125;

  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      const pending = pendingRef.current;
      pendingRef.current = { lead1: [], lead2: [], lead3: [] };
      setRecording((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          lead1: [...prev.lead1, ...pending.lead1],
          lead2: [...prev.lead2, ...pending.lead2],
          lead3: [...prev.lead3, ...pending.lead3],
        };
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isRecording]);

  const startRecording = useCallback(() => {
    sampleCountsRef.current = { lead1: 0, lead2: 0, lead3: 0 };
    pendingRef.current = { lead1: [], lead2: [], lead3: [] };
    setRecording({ lead1: [], lead2: [], lead3: [], timestamp: new Date() });
    setIsRecording(true);
    setRecordingDuration(0);
    startTimeRef.current = Date.now();
    recordingIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - (startTimeRef.current || Date.now())) / 1000;
      setRecordingDuration(Math.min(elapsed, RECORDING_DURATION));
      if (elapsed >= RECORDING_DURATION) {
        setIsRecording(false);
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
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
    sampleCountsRef.current = { lead1: 0, lead2: 0, lead3: 0 };
    pendingRef.current = { lead1: [], lead2: [], lead3: [] };
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  const addEcgSample = useCallback((lead: 'lead1' | 'lead2' | 'lead3', value: number) => {
    if (!isRecording) return;
    // const maxSamples = SAMPLE_RATE * RECORDING_DURATION;
    // if (sampleCountsRef.current[lead] >= maxSamples) return;
    // sampleCountsRef.current[lead]++;
    pendingRef.current[lead].push(value);
  }, [isRecording]);

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