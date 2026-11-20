'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, HeartPulse, Thermometer, Waves } from 'lucide-react';
import { BleSensorCard } from '@/components/ble-sensor-card';
import { EcgSensorCard } from '@/components/ecg-sensor-card';
import { StethoscopeSensorCard } from '@/components/stethoscope-sensor-card';
import ClickToTwoPage from '@/components/clicktotwopage';
import { Button } from '@/components/ui/button';
import { useEcgRecording } from '@/context/ecg-context';
import { useMurmurRecording } from '@/context/murmur-context';
import { usePPGCapture } from '@/context/ppg-context';
import { useVitals } from '@/context/vitals-context';

export default function OpenSensorPage() {
  const ecg = useEcgRecording();
  const murmur = useMurmurRecording();
  const ppg = usePPGCapture();
  const { bpm, spo2, temp } = useVitals();
  const [ecgRate, setEcgRate] = useState<number | null>(null);
  const [hasReceivedData, setHasReceivedData] = useState(false);
  const [isBleConnected, setIsBleConnected] = useState(false);
  const captureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRecording = ecg.isRecording || murmur.isRecording;
  const recordingDuration = Math.max(ecg.recordingDuration, murmur.recordingDuration);
  const handleConnectionChange = useCallback((connected: boolean) => {
    setIsBleConnected(connected);
  }, []);

  useEffect(() => {
    const handleSensorData = (event: Event) => {
      const data = (event as CustomEvent).detail;
      if (!data) return;
      setHasReceivedData(true);
      if (typeof data.ecgRate === 'number') setEcgRate(data.ecgRate);
    };

    window.addEventListener('esp-data', handleSensorData);
    return () => window.removeEventListener('esp-data', handleSensorData);
  }, []);

  useEffect(() => {
    return () => {
      if (captureTimer.current) {
        clearTimeout(captureTimer.current);
        ppg.stopPPGCapture();
      }
    };
  }, [ppg.stopPPGCapture]);

  const startRecording = () => {
    if (isRecording) return;
    ecg.clearRecording();
    murmur.clearRecording();
    ppg.clearPPGCapture();
    ecg.startRecording();
    murmur.startRecording();
    ppg.startPPGCapture();
    captureTimer.current = setTimeout(() => {
      ppg.stopPPGCapture();
      captureTimer.current = null;
    }, 30_000);
  };

  const stopRecording = () => {
    ecg.stopRecording();
    murmur.stopRecording();
    if (captureTimer.current) {
      clearTimeout(captureTimer.current);
      captureTimer.current = null;
    }
    ppg.stopPPGCapture();
  };

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] bg-slate-50 p-4 sm:-m-8 sm:p-8">
      <main className="mx-auto w-full max-w-5xl space-y-3">
        <h1 className="text-center text-xl font-bold text-primary sm:text-2xl">
          CardioSnap – Cardiac Monitoring
        </h1>

        <EcgSensorCard />
        <StethoscopeSensorCard />

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Vital signs">
          <VitalCard
            icon={<HeartPulse className="h-4 w-4 text-rose-500" />}
            value={bpm}
            label="PPG heart rate"
            unit="bpm"
          />
          <VitalCard
            icon={<Activity className="h-4 w-4 text-blue-500" />}
            value={spo2}
            label="Blood oxygen SpO₂"
            unit="%"
            decimals={1}
          />
          <VitalCard
            icon={<Thermometer className="h-4 w-4 text-orange-500" />}
            value={temp}
            label="Temperature"
            unit="°C"
            decimals={1}
          />
          <VitalCard
            icon={<Waves className="h-4 w-4 text-teal-600" />}
            value={ecgRate}
            label="ECG heart rate"
            unit="bpm"
          />
        </section>

        <div
          className={`rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold shadow ${
            hasReceivedData ? 'text-emerald-600' : 'text-muted-foreground'
          }`}
          role="status"
          aria-live="polite"
        >
          {hasReceivedData ? 'Receiving live sensor data' : 'Waiting for sensor data'}
          {isRecording && (
            <span className="ml-2 font-normal text-primary">
              Recording {recordingDuration.toFixed(1)} / 30 seconds
            </span>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <BleSensorCard onConnectionChange={handleConnectionChange} />
          <Button
            onClick={isRecording ? stopRecording : startRecording}
            variant={isRecording ? 'destructive' : 'default'}
            disabled={!isRecording && !isBleConnected}
            className="h-12 text-base font-semibold"
          >
            {isRecording ? 'Stop Recording' : 'Start 30s Recording'}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Connect the sensor first; live readings are collected during the 30-second recording.
        </p>
        <ClickToTwoPage />
      </main>
    </div>
  );
}

function VitalCard({
  icon,
  value,
  label,
  unit,
  decimals = 0,
}: {
  icon: React.ReactNode;
  value: number | null;
  label: string;
  unit: string;
  decimals?: number;
}) {
  return (
    <div className="rounded-xl bg-white px-3 py-3 text-center shadow">
      <div className="mb-1 flex items-center justify-center gap-1">
        {icon}
        <span className="text-2xl font-bold leading-none">
          {value === null ? '--' : value.toFixed(decimals)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {label} ({unit})
      </p>
    </div>
  );
}
