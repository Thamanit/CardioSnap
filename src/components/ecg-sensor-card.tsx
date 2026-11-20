'use client';

import { useEffect, useRef, useState } from 'react';
import { LineChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEcgRecording } from '@/context/ecg-context';

export function EcgSensorCard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const buffer = useRef<number[]>(new Array(300).fill(0));
  const [speed, setSpeed] = useState(100);
  const [scale, setScale] = useState(1.3);
  const [voltage, setVoltage] = useState<number | null>(null);
  const { ecgClassification, addEcgSample } = useEcgRecording();

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    const visibleSamples = speed === 25 ? 75 : speed === 50 ? 150 : 300;
    const samples = buffer.current.slice(-visibleSamples);
    samples.forEach((value, index) => {
      const x = (index * canvas.width) / Math.max(samples.length - 1, 1);
      const y = Math.max(0, Math.min(canvas.height, canvas.height / 2 - (value * 24) / scale));
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#d64b4b';
    ctx.lineWidth = 2.2;
    ctx.stroke();
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const data = (event as CustomEvent).detail;
      const rawSample = Number(data?.ecg);
      if (!Number.isFinite(rawSample)) return;

      const sample = (rawSample - 2048) / 100;
      setVoltage(sample);
      buffer.current.push(sample);
      buffer.current.shift();
      draw();
      addEcgSample('lead2', sample);
    };

    window.addEventListener('esp-data', handler);
    return () => window.removeEventListener('esp-data', handler);
  }, [addEcgSample]);

  useEffect(() => {
    draw();
  }, [speed, scale]);

  return (
    <Card className="overflow-hidden rounded-2xl border-0 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
          <LineChart className="h-5 w-5 text-primary" />
          ECG Lead II — {speed} mm/s | {scale.toFixed(1)} mm/mV | 250 Hz
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-slate-50 p-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Sweep speed</span>
            {[25, 50, 100].map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={speed === value ? 'default' : 'outline'}
                className="h-7 px-2"
                onClick={() => setSpeed(value)}
              >
                {value} mm/s
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-1 text-muted-foreground">Gain</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              aria-label="Decrease ECG gain"
              onClick={() => setScale((value) => Math.max(0.5, value - 0.2))}
            >
              −
            </Button>
            <span className="min-w-16 text-center">{scale.toFixed(1)} mm/mV</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              aria-label="Increase ECG gain"
              onClick={() => setScale((value) => Math.min(3, value + 0.2))}
            >
              +
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Latest ECG</span>
          <span className="font-semibold text-primary">
            {voltage === null ? '--' : `${voltage.toFixed(3)} mV`}
          </span>
        </div>
        <canvas
          ref={canvasRef}
          width={900}
          height={145}
          className="ecg-grid w-full rounded-md"
          aria-label="Live ECG waveform"
        />

        {ecgClassification && (
          <div className="rounded-lg border bg-muted/50 p-3 text-sm">
            <h3 className="mb-2 font-semibold">ECG Classification</h3>
            <p>
              <span className="font-medium">Prediction:</span>{' '}
              {ecgClassification.overall_prediction}
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Probabilities
              </summary>
              <pre className="mt-1 text-xs">
                {JSON.stringify(ecgClassification.average_probabilities, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
