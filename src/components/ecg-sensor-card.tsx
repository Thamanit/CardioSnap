'use client';

import { useEffect, useRef } from 'react';
import { LineChart, Circle, Square } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEcgRecording } from '@/context/ecg-context';

export function EcgSensorCard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const buffer = useRef<number[]>(new Array(300).fill(0));
  const leadCounterRef = useRef(0); // distribute samples to lead1, lead2, lead3
  const {
    recording,
    isRecording,
    recordingDuration,
    ecgClassification,
    startRecording,
    stopRecording,
    addEcgSample,
  } = useEcgRecording();

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    buffer.current.forEach((v, i) => {
      const x = (i * canvas.width) / buffer.current.length;
      let y = canvas.height - v * 40;
      if (y < 0) y = 0;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const data = customEvent.detail;
      if (!data) return;

      const ecg = Math.max(0, (data.ecg - 2048) / 100);
      buffer.current.push(ecg);
      buffer.current.shift();
      draw();

      // Distribute samples to all three leads
      // // if (isRecording) {
      // //   const leadIndex = leadCounterRef.current % 3;
      // //   if (leadIndex === 0) {
      //     addEcgSample('lead1', ecg);
      //   } else if (leadIndex === 1) {
          addEcgSample('lead2', ecg);
        // } else {
        //   addEcgSample('lead3', ecg);
        // }
        // leadCounterRef.current++;
      // }
    };

    window.addEventListener('esp-data', handler);
    return () => window.removeEventListener('esp-data', handler);
  }, [isRecording, addEcgSample]);

  const getRecordingStatus = () => {
    if (!isRecording) return null;
    return `Recording: ${recordingDuration.toFixed(1)}s / 10.0s`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <LineChart className="w-6 h-6" />
          ECG Real-time
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">25mm/sec 10mm/mV</div>
        <canvas
          ref={canvasRef}
          width={800}
          height={200}
          className="w-full border rounded mt-4"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isRecording && <Circle className="w-4 h-4 fill-red-500 text-red-500 animate-pulse" />}
            {getRecordingStatus() && (
              <span className="text-sm font-semibold text-red-600">{getRecordingStatus()}</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={startRecording}
              disabled={isRecording}
              variant={isRecording ? 'outline' : 'default'}
              className="gap-2"
            >
              <Circle className="w-4 h-4" />
              Record (10s)
            </Button>
            <Button
              onClick={stopRecording}
              disabled={!isRecording}
              variant="destructive"
              className="gap-2"
            >
              <Square className="w-4 h-4" />
              Stop
            </Button>
          </div>
        </div>

        {/* Show ECG classification result */}
        {ecgClassification && (
          <div className="mt-4 p-4 border rounded bg-muted/50">
            <h3 className="font-semibold mb-2">ECG Classification</h3>
            <p>
              <span className="font-medium">Prediction:</span>{' '}
              {ecgClassification.overall_prediction}
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Probabilities
              </summary>
              <pre className="text-xs mt-1">
                {JSON.stringify(ecgClassification.average_probabilities, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}