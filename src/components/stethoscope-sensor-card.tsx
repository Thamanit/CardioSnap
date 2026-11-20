'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Stethoscope, Heart, RefreshCw, Download, BrainCircuit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useMurmurRecording } from '@/context/murmur-context';
import { usePPGCapture } from '@/context/ppg-context';
import { useVitals } from '@/context/vitals-context';
import { useToast } from '@/hooks/use-toast';

const dummyPrediction = {
  murmur: "Present (Holosystolic)",
  confidence: 0.85,
  cycle: { s1: 0.2, s2: 0.5, systole: 0.3, diastole: 0.7 },
  quality: "Good",
};

export function StethoscopeSensorCard() {
  const murmurContext = useMurmurRecording();
  const ppgContext = usePPGCapture();
  const vitals = useVitals();
  const { toast } = useToast();

  const { setBpm, setSpo2, setTemp } = vitals;
  const [progress, setProgress] = useState(0);
  const [showPrediction, setShowPrediction] = useState(false);
  // A local copy of captured samples used only for WAV export
  const localSamplesRef = useRef<number[]>([]);
  const wasRecordingRef = useRef(false);

  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Ring buffer for waveform display — never triggers re-renders
  const audioBuffer = useRef<number[]>(new Array(400).fill(0));

  // ── Bandpass filter state (refs → no stale closure) ──
  const prevInput = useRef(0);
  const prevOutput = useRef(0);

  // Keep a stable ref to addMurmurSample so the event handler never goes stale
  const addSampleRef = useRef(murmurContext.addMurmurSample);
  const isRecordingRef = useRef(murmurContext.isRecording);
  const addPPGSampleRef = useRef(ppgContext.addPPGSample);
  
  useEffect(() => {
    addSampleRef.current = murmurContext.addMurmurSample;
  }, [murmurContext.addMurmurSample]);
  
  useEffect(() => {
    isRecordingRef.current = murmurContext.isRecording;
  }, [murmurContext.isRecording]);

  useEffect(() => {
    if (murmurContext.isRecording && !wasRecordingRef.current) {
      localSamplesRef.current = [];
      setShowPrediction(false);
    }
    wasRecordingRef.current = murmurContext.isRecording;
  }, [murmurContext.isRecording]);

  useEffect(() => {
    addPPGSampleRef.current = ppgContext.addPPGSample;
  }, [ppgContext.addPPGSample]);

  // ── Progress bar driven by recordingDuration from context ──
  useEffect(() => {
    setProgress((murmurContext.recordingDuration / 30) * 100);
  }, [murmurContext.recordingDuration]);

  // Reset progress when not recording
  useEffect(() => {
    if (!murmurContext.isRecording) setProgress(0);
  }, [murmurContext.isRecording]);

  // ── Filter ──
  const bandpassFilter = useCallback((sample: number) => {
    const alpha = 0.95;
    const beta = 0.05;
    const highPass = alpha * (prevOutput.current + sample - prevInput.current);
    const lowPass = beta * highPass + (1 - beta) * prevOutput.current;
    prevInput.current = sample;
    prevOutput.current = lowPass;
    return lowPass;
  }, []);

  // ── Draw waveform ──
  const drawWaveform = useCallback(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    audioBuffer.current.forEach((v, i) => {
      const x = (i * canvas.width) / audioBuffer.current.length;
      const y = Math.max(0, Math.min(canvas.height, canvas.height / 2 - v * 50));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#0d9488';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, []);

  // ── ESP event handler — registered once, reads only refs ──
  useEffect(() => {
    let sampleCount = 0;
    let lastLogTime = Date.now();
    
    console.log('[ESP Listener] Attached to esp-data events');
    
    const handler = (event: Event) => {
      const data = (event as CustomEvent).detail;
      if (!data) return;

      if (data.pcg !== undefined) {
        const raw = (data.pcg - 2048) / 120;
        const filtered = bandpassFilter(raw);

        audioBuffer.current.push(filtered);
        audioBuffer.current.shift();

        // Write into context buffer AND local copy via refs — no closure issues
        if (isRecordingRef.current) {
          addSampleRef.current(filtered);
          localSamplesRef.current.push(filtered);
          sampleCount++;
          
          // Log every second
          const now = Date.now();
          if (now - lastLogTime >= 1000) {
            console.log(`[ESP] Last 1s: ${sampleCount} samples received`);
            sampleCount = 0;
            lastLogTime = now;
          }
        }
      }

      if (data.bpm)  setBpm(data.bpm);
      if (data.spo2) {
        const clamped = data.spo2 > 100 ? 100 : data.spo2;
        setSpo2(clamped);
        // Normalize spo2 (0-100) to PPG sample (-1 to 1 range)
        const ppgSample = (data.spo2 / 50) - 1; // Maps 0-100 to -1 to 1
        addPPGSampleRef.current(ppgSample);
      }
      if (data.temp) setTemp(data.temp);

      requestAnimationFrame(drawWaveform);
    };

    window.addEventListener('esp-data', handler);
    return () => {
      window.removeEventListener('esp-data', handler);
      console.log('[ESP Listener] Detached from esp-data events');
    };
  }, [bandpassFilter, drawWaveform]); // stable callbacks → only registers once

  // ── Initial draw ──
  useEffect(() => { drawWaveform(); }, [drawWaveform]);

  // ── WAV export ──
  const downloadWav = () => {
    const samples = localSamplesRef.current;
    
    console.log('===== [DOWNLOAD WAV] =====');
    console.log('Sample count:', samples.length);
    console.log('Expected: 120,000 (4000 Hz × 30 sec)');
    console.log('Actual duration:', (samples.length / 4000).toFixed(2), 'seconds');
    console.log('First 5 samples:', samples.slice(0, 5));
    console.log('Last 5 samples:', samples.slice(-5));
    console.log('Full data:', samples);
    
    if (samples.length === 0) {
      console.error('❌ NO SAMPLES - Recording failed!');
      toast({ title: 'No Recording', description: 'Please record audio first.', variant: 'destructive' });
      return;
    }
    
    const sampleRate = 4000;
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true);
    ws(8, 'WAVE'); ws(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    ws(36, 'data'); view.setUint32(40, samples.length * 2, true);
    let offset = 44;
    samples.forEach(s => { view.setInt16(offset, Math.max(-1, Math.min(1, s)) * 32767, true); offset += 2; });
    const blob = new Blob([view], { type: 'audio/wav' });
    
    console.log('✅ WAV created:', blob.size, 'bytes');
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'stethoscope_recording.wav';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleRestart = () => {
    murmurContext.clearRecording();
    ppgContext.clearPPGCapture();
    localSamplesRef.current = [];
    setShowPrediction(false);
    toast({ title: 'Recording Cleared', description: 'Ready for new recording.' });
  };

  const handleAnalyze = () => {
    if (localSamplesRef.current.length > 0) {
      setShowPrediction(true);
      downloadWav();
    } else {
      toast({ title: 'No Recording', description: 'Please record audio first.', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Stethoscope className="w-6 h-6" />
          PCG / Stethoscope (500 Hz)
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-2">
          <canvas
            ref={waveCanvasRef}
            width={800}
            height={145}
            className="ecg-grid w-full rounded-md"
            aria-label="Live phonocardiogram waveform"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {showPrediction && (
            <Card className="w-full border-blue-200 bg-blue-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-blue-700" />
                  AI Prediction Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <strong>Murmur:</strong>
                  <Badge variant={dummyPrediction.murmur.includes('Present') ? 'destructive' : 'secondary'}>
                    {dummyPrediction.murmur}
                  </Badge>
                </div>
                <div className="flex justify-between"><strong>Confidence:</strong> <span>{(dummyPrediction.confidence * 100).toFixed(1)}%</span></div>
                <div className="flex justify-between"><strong>Audio Quality:</strong> <span>{dummyPrediction.quality}</span></div>
                <div className="text-xs text-muted-foreground pt-2">
                  Heart Cycle: S1 {dummyPrediction.cycle.s1}s · S2 {dummyPrediction.cycle.s2}s
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Heart className="h-4 w-4 text-primary" />
            <span>
              {murmurContext.isRecording
                ? `Recording… ${murmurContext.recordingDuration.toFixed(1)}s`
                : murmurContext.recording ? 'Recording complete' : 'Waiting for recording'}
            </span>
            <Progress value={progress} className="h-2 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRestart} disabled={murmurContext.isRecording}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Clear
            </Button>
            <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={murmurContext.isRecording}>
              <Download className="mr-2 h-4 w-4" />
              Export audio
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}