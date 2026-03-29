
'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, FileImage } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function NailfoldSensorCard() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const getCameraPermission = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('Camera API not available.');
        setHasCameraPermission(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings.',
        });
      }
    };

    getCameraPermission();

    return () => {
        // Cleanup: stop video stream when component unmounts
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    };
  }, [toast]);
  
  const handleCapture = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/png');
        setCapturedImage(dataUri);
      }
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileImage className="w-6 h-6" />
          เส้นเลือดฝอยปลายนิ้ว (Nailfold Capillaroscopy)
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 flex flex-col items-center justify-center p-4 border rounded-md bg-gray-100">
            <video ref={videoRef} className="w-full aspect-video rounded-md bg-black" autoPlay muted playsInline />
            {hasCameraPermission === false && (
                <Alert variant="destructive" className="mt-2">
                  <Camera className="h-4 w-4" />
                  <AlertTitle>Camera Access Required</AlertTitle>
                  <AlertDescription>
                    Please allow camera access.
                  </AlertDescription>
              </Alert>
            )}
            <Button onClick={handleCapture} disabled={!hasCameraPermission} className="mt-2 w-full bg-gray-600 hover:bg-gray-700 text-white">
                <Camera className="mr-2 h-4 w-4" />
                ถ่ายภาพ
            </Button>
        </div>
        <label
            htmlFor="file-upload"
            className="cursor-pointer space-y-2 flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-md hover:border-gray-400 bg-gray-100"
            >
            <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm font-semibold text-gray-600">upload file</p>
            </div>
            <input id="file-upload" name="file-upload" type="file" className="sr-only" />
        </label>

        {capturedImage && (
            <div className="md:col-span-2 p-4 border rounded-md">
                <h3 className="text-center font-semibold mb-2">Captured Image:</h3>
                <img src={capturedImage} alt="Captured nailfold" className="rounded-md mx-auto max-h-60" />
            </div>
        )}
      </CardContent>
    </Card>
  );
}
