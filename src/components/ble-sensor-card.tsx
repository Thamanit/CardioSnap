'use client';

import { useState, useEffect } from 'react';
import { Bluetooth, BluetoothConnected, BluetoothSearching, WifiOff, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useToast } from '@/hooks/use-toast';

// IMPORTANT: Replace these with the actual UUIDs from your ESP32 firmware.
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b'; // Example custom service UUID
const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8'; // Example custom characteristic UUID

export function BleSensorCard() {
  const [device, setDevice] = useState<any>(null);
  const [server, setServer] = useState<any>(null);
  const [sensorValue, setSensorValue] = useState<string>('--');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const isConnected = server?.connected;

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);

    if (!(navigator as any).bluetooth) {
      setError('Web Bluetooth API is not available on this browser. Please use Google Chrome.');
      setIsLoading(false);
      return;
    }

    try {
      toast({
        title: 'Searching for devices...',
        description: 'Please select your ESP32 from the popup window.',
      });

      const bleDevice = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        // Or you can use acceptAllDevices: true and then filter by name, but services is better.
        // acceptAllDevices: true
      });

      if (!bleDevice) {
        throw new Error('No device selected.');
      }

      setDevice(bleDevice);
      bleDevice.addEventListener('gattserverdisconnected', onDisconnected);

      toast({ title: 'Connecting to device...', description: bleDevice.name || bleDevice.id });
      const gattServer = await bleDevice.gatt?.connect();
      if (!gattServer) {
        throw new Error('Could not connect to GATT server.');
      }
      setServer(gattServer);

      const service = await gattServer.getPrimaryService(SERVICE_UUID);
      const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);

      toast({
        title: 'Connection Successful!',
        description: `Now receiving data from ${bleDevice.name || bleDevice.id}.`,
      });

    } catch (err: any) {
      console.error('Bluetooth connection error:', err);
      setError(err.message || 'An error occurred during connection.');
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: err.message || 'Could not connect to the device.',
      });
      // Clear up state
      setDevice(null);
      setServer(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    if (server?.connected) {
      server.disconnect();
    } else {
      // Clean up state if disconnect is called in a weird state
      onDisconnected();
    }
  };

  const onDisconnected = () => {
    toast({
      title: 'Device Disconnected',
      description: device?.name || 'The device has been disconnected.',
    });
    setDevice(null);
    setServer(null);
    setSensorValue('--');
  };

  const handleCharacteristicValueChanged = (event: any) => {
    const target = event.target;
    const value = target.value;
    if (!value) return;

    // Assuming the data is a UTF-8 encoded string.
    // You might need to parse it differently (e.g., as a number).
    // Example for a single byte (uint8): value.getUint8(0)
    // Example for a 4-byte float: value.getFloat32(0, /*little-endian*/ true)
    const decodedValue = new TextDecoder('utf-8').decode(value);

    setSensorValue(decodedValue)

    try {
      const data = JSON.parse(decodedValue)

      window.dispatchEvent(
        new CustomEvent("esp-data", {
          detail: data
        })
      )

    } catch (e) {
      console.log("JSON parse error")
    }
  };

  // Clean up connection on component unmount
  useEffect(() => {
    return () => {
      if (server?.connected) {
        server.disconnect();
      }
    }
  }, [server]);


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bluetooth className="w-6 h-6" />
          ESP32 BLE Sensor
        </CardTitle>
        <CardDescription>
          Connect to your ESP32 device to read sensor data in real-time via Bluetooth.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <WifiOff className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted">
          <div className="flex items-center gap-2">
            {isConnected ? <BluetoothConnected className="text-blue-500" /> : <BluetoothSearching />}
            <span className="text-sm font-medium text-muted-foreground">
              Status: {isLoading ? "Connecting..." : isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          {device && <span className="text-sm font-semibold">{device.name || device.id}</span>}
        </div>

        <Card className="text-center">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-muted-foreground">Raw Sensor Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tracking-tighter h-8 overflow-hidden text-ellipsis">{sensorValue}</p>
          </CardContent>
        </Card>

        {isConnected ? (
          <Button onClick={handleDisconnect} variant="destructive" className="w-full">
            <WifiOff className="mr-2 h-4 w-4" />
            Disconnect
          </Button>
        ) : (
          <Button onClick={handleConnect} disabled={isLoading} className="w-full">
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Bluetooth className="mr-2 h-4 w-4" />
            )}
            {isLoading ? "Connecting..." : "Connect to ESP32"}
          </Button>
        )}
        <Alert>
          <AlertTitle>Configuration Note</AlertTitle>
          <AlertDescription className="text-xs">
            Make sure your ESP32 is advertising the service with UUID: <code className="font-mono bg-gray-200 p-1 rounded">{SERVICE_UUID}</code>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
