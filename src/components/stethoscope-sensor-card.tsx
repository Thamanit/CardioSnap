'use client';

import { useState, useEffect, useRef } from 'react';
import { Stethoscope, Heart, Waves, VolumeX, RefreshCw, Download, BrainCircuit, Thermometer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useMurmurRecording } from '@/context/murmur-context';
import { useToast } from '@/hooks/use-toast';

// Dummy AI Prediction data
const dummyPrediction = {
  murmur: "Present (Holosystolic)",
  confidence: 0.85,
  cycle: { s1: 0.2, s2: 0.5, systole: 0.3, diastole: 0.7 },
  quality: "Good"
}

export function StethoscopeSensorCard() {
  const murmurContext = useMurmurRecording();
  const { toast } = useToast();

  const [bpm, setBpm] = useState<number | null>(null)
  const [spo2, setSpo2] = useState<number | null>(null)
  const [temp, setTemp] = useState<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [showPrediction, setShowPrediction] = useState(false);
  const [localRecordBuffer, setLocalRecordBuffer] = useState<number[]>([]);

  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioBuffer = useRef<number[]>(new Array(400).fill(0))
  const recordTimer = useRef<NodeJS.Timeout | null>(null)

  // ===== Bandpass Filter (simple IIR) =====
  const prevInput = useRef(0)
  const prevOutput = useRef(0)

  const bandpassFilter = (sample: number) => {
    const alpha = 0.95; // Smoothing factor for the high-pass filter
    const beta = 0.05;  // Smoothing factor for the low-pass filter component

    // Simple high-pass filter
    const highPass = alpha * (prevOutput.current + sample - prevInput.current);
    // Simple low-pass filter on the high-pass output to create a bandpass effect
    const lowPass = beta * highPass + (1 - beta) * prevOutput.current;

    prevInput.current = sample;
    prevOutput.current = lowPass;

    return lowPass;
  }

  // ===== Draw Waveform =====
  const drawWaveform = () => {
    const canvas = waveCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.beginPath()
    audioBuffer.current.forEach((v, i) => {
      const x = i * canvas.width / audioBuffer.current.length
      // Simple scaling for visualization
      let y = canvas.height / 2 - v * 50
      y = Math.max(0, Math.min(canvas.height, y)) // Clamp to canvas bounds
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = "#0d9488" // teal-600
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // ===== Export WAV =====
  const downloadWav = () => {
    const samples = localRecordBuffer
    if (samples.length === 0) {
      console.log("No audio data to download.");
      return;
    }
    const sampleRate = 4000 // Matching typical PCG sample rates
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i))
      }
    }

    writeString(0, 'RIFF')
    view.setUint32(4, 36 + samples.length * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true) // Mono
    view.setUint16(22, 1, true) // 1 Channel
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true) // Byte Rate
    view.setUint16(32, 2, true) // Block Align
    view.setUint16(34, 16, true) // 16-bit
    writeString(36, 'data')
    view.setUint32(40, samples.length * 2, true)

    let offset = 44
    samples.forEach(s => {
      const val = Math.max(-1, Math.min(1, s))
      view.setInt16(offset, val * 32767, true)
      offset += 2
    })

    const blob = new Blob([view], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "stethoscope_recording.wav"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ===== Receive ESP Data =====
  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent
      const data = customEvent.detail
      if (!data) return;

      // Handle PCG data for waveform
      if(data.pcg !== undefined) {
          const rawPcg = (data.pcg - 2048) / 120; // Normalize raw data
          const filteredPcg = bandpassFilter(rawPcg);

          audioBuffer.current.push(filteredPcg)
          audioBuffer.current.shift()

          if (murmurContext.isRecording) {
            murmurContext.addMurmurSample(filteredPcg);
            setLocalRecordBuffer(prev => [...prev, filteredPcg]);
          }
      }

      // Update state for real-time values from PPG/other sensors
      if (data.bpm) setBpm(data.bpm)
      if (data.spo2) setSpo2(data.spo2 > 100 ? 98 : data.spo2) // Cap SpO2 at 100
      if (data.temp) setTemp(data.temp)

      requestAnimationFrame(() => {
        drawWaveform();
      });
    }

    window.addEventListener("esp-data", handler)
    return () => window.removeEventListener("esp-data", handler)
  }, [murmurContext])

  // ===== Progress Timer for Recording =====
  useEffect(() => {
    if (!murmurContext.isRecording) {
      setProgress(0)
      if (recordTimer.current) clearTimeout(recordTimer.current)
      return
    }

    // Automatically stop after 10 seconds
    recordTimer.current = setTimeout(() => {
      murmurContext.stopRecording();
    }, 10000);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 1, 100));
    }, 100)

    return () => {
      clearInterval(progressInterval)
      if (recordTimer.current) clearTimeout(recordTimer.current)
    }
  }, [murmurContext.isRecording])

  // ===== Initial Draw =====
  useEffect(() => {
    drawWaveform();
  }, [])

  // ===== Record Control =====
  const startRecording = () => {
    setLocalRecordBuffer([]);
    setShowPrediction(false);
    murmurContext.startRecording();
    toast({
      title: "Recording Started",
      description: "Recording murmur for 10 seconds...",
    });
  }

  const stopRecording = () => {
    murmurContext.stopRecording();
    toast({
      title: "Recording Stopped",
      description: "Murmur recording loaded. Ready to submit.",
    });
  }

  const toggleRecord = () => {
    if (murmurContext.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  const handleRestart = () => {
    murmurContext.clearRecording();
    setLocalRecordBuffer([]);
    setProgress(0);
    setShowPrediction(false);
    toast({
      title: "Recording Cleared",
      description: "Ready for new recording.",
    });
  }

  const handleAnalyze = () => {
    if (localRecordBuffer.length > 0) {
      setShowPrediction(true);
      downloadWav();
    } else {
      toast({
        title: "No Recording",
        description: "Please record audio first.",
        variant: "destructive",
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Stethoscope className="w-6 h-6" />
          Stethoscope (Phonocardiogram)
        </CardTitle>
      </CardHeader>

      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: Waveform */}
        <div className="space-y-2">
          <h3 className="font-semibold text-center text-muted-foreground">Real-time PCG Waveform</h3>
          <canvas
            ref={waveCanvasRef}
            width={800}
            height={340}
            className="w-full border rounded-lg bg-gray-50"
          />
        </div>

        {/* Right Column: Controls & Prediction */}
        <div className="space-y-4 flex flex-col justify-between">
          <div className="flex justify-around items-center gap-4 text-sm text-muted-foreground p-2 rounded-lg bg-slate-50">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              <span>{bpm ?? '--'} BPM</span>
            </div>
            <div className="flex items-center gap-2">
              <Waves className="w-5 h-5 text-blue-500" />
              <span>{spo2 ?? '--'} % SpO₂</span>
            </div>
            <div className="flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-orange-500" />
              <span>{temp ?? '--'} °C</span>
            </div>
          </div>

          <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
            <div className="flex items-center">
              <VolumeX className="h-5 w-5 mr-2" />
              <AlertDescription>NO TALKING: Quiet patient for accurate results.</AlertDescription>
            </div>
          </Alert>

          {/* AI Prediction Panel */}
          {showPrediction && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-blue-700" />
                  AI Prediction Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between"><strong>Murmur:</strong> <Badge variant={dummyPrediction.murmur.includes("Present") ? "destructive" : "secondary"}>{dummyPrediction.murmur}</Badge></div>
                <div className="flex justify-between"><strong>Confidence:</strong> <span>{(dummyPrediction.confidence * 100).toFixed(1)}%</span></div>
                <div className="flex justify-between"><strong>Audio Quality:</strong> <span>{dummyPrediction.quality}</span></div>
                <div className="text-xs text-muted-foreground pt-2">Heart Cycle (s1-s2 timing): S1: {dummyPrediction.cycle.s1}s, S2: {dummyPrediction.cycle.s2}s</div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2 pt-2">
            <div className="text-center">
              <p className="text-sm font-medium">
                {murmurContext.isRecording ? `Recording... (${murmurContext.recordingDuration.toFixed(1)}s / 10s)` : "Ready to Record"}
              </p>
              <Progress value={progress} className="h-2 mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <Button className="flex-1" onClick={toggleRecord} variant={murmurContext.isRecording ? 'destructive' : 'default'}>
                {murmurContext.isRecording ? 'Stop Recording (10s)' : 'Record (10s)'}
              </Button>
              <Button variant="secondary" size="icon" onClick={handleRestart}><RefreshCw className="w-4 h-4" /></Button>
              <Button variant="secondary" size="icon" onClick={handleAnalyze}><Download className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
