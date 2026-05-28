'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface PPGContextType {
  ppgWavBlob: File | null;
  startPPGCapture: () => void;
  stopPPGCapture: () => void;
  addPPGSample: (value: number) => void;
  clearPPGCapture: () => void;
}

const PPGContext = createContext<PPGContextType | undefined>(undefined);

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

const SAMPLE_RATE = 100; // PPG typically sampled at lower rate than audio
const MAX_SAMPLES = SAMPLE_RATE * 10; // 10 seconds of capture

export function PPGProvider({ children }: { children: React.ReactNode }) {
  const [ppgWavBlob, setPpgWavBlob] = useState<File | null>(null);
  const ppgSamplesRef = React.useRef<number[]>([]);
  const isCapturingRef = React.useRef(false);

  const startPPGCapture = useCallback(() => {
    ppgSamplesRef.current = [];
    isCapturingRef.current = true;
    setPpgWavBlob(null);
    console.log('[PPG] Capture started');
  }, []);

  const stopPPGCapture = useCallback(() => {
    isCapturingRef.current = false;
    const samples = [...ppgSamplesRef.current];
    
    console.log('===== [PPG CAPTURE STOPPED] =====');
    console.log('Captured samples:', samples.length);
    console.log('Expected samples:', SAMPLE_RATE * 10);
    console.log('Sample rate:', (samples.length / 10).toFixed(0), 'Hz');

    if (samples.length > 0) {
      const wavBlob = encodeWav(samples, SAMPLE_RATE);
      const wavFile = new File([wavBlob], 'ppg_recording.wav', { type: 'audio/wav' });
      setPpgWavBlob(wavFile);
      console.log('✅ PPG WAV file created, size:', wavBlob.size, 'bytes');
    } else {
      console.warn('⚠️ NO PPG SAMPLES CAPTURED');
    }
  }, []);

  const addPPGSample = useCallback((value: number) => {
    if (!isCapturingRef.current) return;
    if (ppgSamplesRef.current.length >= MAX_SAMPLES) return;
    
    ppgSamplesRef.current.push(value);
  }, []);

  const clearPPGCapture = useCallback(() => {
    ppgSamplesRef.current = [];
    isCapturingRef.current = false;
    setPpgWavBlob(null);
  }, []);

  return (
    <PPGContext.Provider
      value={{
        ppgWavBlob,
        startPPGCapture,
        stopPPGCapture,
        addPPGSample,
        clearPPGCapture,
      }}
    >
      {children}
    </PPGContext.Provider>
  );
}

export function usePPGCapture() {
  const context = useContext(PPGContext);
  if (context === undefined) {
    throw new Error('usePPGCapture must be used within PPGProvider');
  }
  return context;
}
