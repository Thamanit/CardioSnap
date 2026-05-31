'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface VitalsContextType {
  bpm: number | null;
  spo2: number | null;
  temp: number | null;
  setBpm: (value: number | null) => void;
  setSpo2: (value: number | null) => void;
  setTemp: (value: number | null) => void;
  clearVitals: () => void;
}

const VitalsContext = createContext<VitalsContextType | undefined>(undefined);

export function VitalsProvider({ children }: { children: React.ReactNode }) {
  const [bpm, setBpmState] = useState<number | null>(null);
  const [spo2, setSpo2State] = useState<number | null>(null);
  const [temp, setTempState] = useState<number | null>(null);

  const setBpm = useCallback((value: number | null) => {
    setBpmState(value);
  }, []);

  const setSpo2 = useCallback((value: number | null) => {
    setSpo2State(value);
  }, []);

  const setTemp = useCallback((value: number | null) => {
    setTempState(value);
  }, []);

  const clearVitals = useCallback(() => {
    setBpmState(null);
    setSpo2State(null);
    setTempState(null);
  }, []);

  return (
    <VitalsContext.Provider
      value={{
        bpm,
        spo2,
        temp,
        setBpm,
        setSpo2,
        setTemp,
        clearVitals,
      }}
    >
      {children}
    </VitalsContext.Provider>
  );
}

export function useVitals() {
  const context = useContext(VitalsContext);
  if (context === undefined) {
    throw new Error('useVitals must be used within VitalsProvider');
  }
  return context;
}
