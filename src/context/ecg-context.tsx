'use client';
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { classifyEcg } from '@/firebase/actions';

interface EcgRecording {
  lead1: number[];
  lead2: number[];
  lead3: number[];
  timestamp: Date;
}

interface EcgClassificationResult {
  overall_prediction: string;
  average_probabilities: Record<string, number>;
  num_beats_detected?: number;
  leads_used?: string[];
}

interface EcgContextType {
  recording: EcgRecording | null;
  isRecording: boolean;
  recordingDuration: number;
  ecgClassification: EcgClassificationResult | null;
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
  const [ecgClassification, setEcgClassification] = useState<EcgClassificationResult | null>(null);

  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pendingRef = useRef<{ lead1: number[]; lead2: number[]; lead3: number[] }>({
    lead1: [],
    lead2: [],
    lead3: [],
  });

  // Refs that always hold the latest functions
  const getCompleteLeadsRef = useRef<() => { lead1: number[]; lead2: number[]; lead3: number[] }>(() => ({
    lead1: [],
    lead2: [],
    lead3: [],
  }));
  const performClassificationRef = useRef<(leads: { lead1: number[]; lead2: number[]; lead3: number[] }) => Promise<void>>(
    async () => {}
  );

  const RECORDING_DURATION = 10;

  const flushPending = useCallback(() => {
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
  }, []);

  // Periodically flush
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      flushPending();
    }, 100);
    return () => clearInterval(interval);
  }, [isRecording, flushPending]);

  // Complete leads helper
  const getCompleteLeads = useCallback(() => {
    const leads = {
      lead1: [...(recording?.lead1 || []), ...pendingRef.current.lead1],
      lead2: [...(recording?.lead2 || []), ...pendingRef.current.lead2],
      lead3: [...(recording?.lead3 || []), ...pendingRef.current.lead3],
    };
    console.log('getCompleteLeads:', {
      lead1_len: leads.lead1.length,
      lead2_len: leads.lead2.length,
      lead3_len: leads.lead3.length,
    });
    return leads;
  }, [recording]);

  // Classification
  const performClassification = useCallback(async (leads: { lead1: number[]; lead2: number[]; lead3: number[] }) => {
    try {
      const result = await classifyEcg(leads);
      setEcgClassification(result);
    } catch (error) {
      console.error('ECG classification failed:', error);
      setEcgClassification(null);
    }
  }, []);

  // Keep refs up to date
  useEffect(() => {
    getCompleteLeadsRef.current = getCompleteLeads;
    performClassificationRef.current = performClassification;
  }, [getCompleteLeads, performClassification]);

  const startRecording = useCallback(() => {
    pendingRef.current = { lead1: [], lead2: [], lead3: [] };
    setRecording({ lead1: [], lead2: [], lead3: [], timestamp: new Date() });
    setIsRecording(true);
    setRecordingDuration(0);
    setEcgClassification(null);
    startTimeRef.current = Date.now();

    // Clear any existing interval
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }

    recordingIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - (startTimeRef.current || Date.now())) / 1000;
      setRecordingDuration(Math.min(elapsed, RECORDING_DURATION));

      if (elapsed >= RECORDING_DURATION) {
        // Use the latest functions via refs
        const finalLeads = getCompleteLeadsRef.current();
        console.log('Auto-stop finalLeads:', finalLeads);
        flushPending();
        setIsRecording(false);
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
        performClassificationRef.current(finalLeads);
      }
    }, 10);
  }, [flushPending]); // only flushPending is stable; we don't depend on the callbacks themselves

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;
    const finalLeads = getCompleteLeadsRef.current(); // use ref to be safe
    flushPending();
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    await performClassificationRef.current(finalLeads);
  }, [isRecording, flushPending]);

  const clearRecording = useCallback(() => {
    setRecording(null);
    setIsRecording(false);
    setRecordingDuration(0);
    setEcgClassification(null);
    pendingRef.current = { lead1: [], lead2: [], lead3: [] };
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  const addEcgSample = useCallback(
    (lead: 'lead1' | 'lead2' | 'lead3', value: number) => {
      if (!isRecording) return;
      if (!isFinite(value)) return;
      pendingRef.current[lead].push(value);
    },
    [isRecording]
  );

  const value: EcgContextType = {
    recording,
    isRecording,
    recordingDuration,
    ecgClassification,
    startRecording,
    stopRecording,
    clearRecording,
    addEcgSample,
  };

  return <EcgContext.Provider value={value}>{children}</EcgContext.Provider>;
}

export function useEcgRecording() {
  const context = useContext(EcgContext);
  if (context === undefined) {
    throw new Error('useEcgRecording must be used within EcgProvider');
  }
  return context;
}