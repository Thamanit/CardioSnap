'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send } from 'lucide-react';

export default function ClickToTwoPage() {
  const router = useRouter();
  const [latestData, setLatestData] = useState<any>({});

  // Listen for the latest sensor data from any card
  useEffect(() => {
    const handleSensorData = (event: Event) => {
      const customEvent = event as CustomEvent;
      setLatestData((prevData: any) => ({ ...prevData, ...customEvent.detail }));
    };

    window.addEventListener('esp-data', handleSensorData);

    return () => {
      window.removeEventListener('esp-data', handleSensorData);
    };
  }, []);

  // const handleSendData = () => {
  //   const query = new URLSearchParams();

  //   // Append only the relevant, latest data
  //   if (latestData.bpm) query.append('ppgHeartRate', latestData.bpm.toString());
  //   if (latestData.spo2) query.append('oxygenSaturation', latestData.spo2.toString());
  //   if (latestData.temp) query.append('bodyTemp', latestData.temp.toString());
  //   if (latestData.ecgRate) query.append('ecgRate', latestData.ecgRate.toString());
  //   if (latestData.lead1) query.append('ecgLead1', latestData.lead1.toString());
  //   if (latestData.lead2) query.append('ecgLead2', latestData.lead2.toString());
  //   if (latestData.lead3) query.append('ecgLead3', latestData.lead3.toString());
  //   if (latestData.estimatedBp) query.append('estimatedBp', latestData.estimatedBp);

  //   console.log("Sending data to form:", Object.fromEntries(query));

  //   router.push(`/data-entry?${query.toString()}`);
  // };
  const handleSendData = () => {
    const query = new URLSearchParams();

    if (latestData.bpm) query.append('ppgHeartRate', latestData.bpm.toString());
    if (latestData.spo2) query.append('oxygenSaturation', latestData.spo2.toString());
    if (latestData.temp) query.append('bodyTemp', latestData.temp.toString());
    if (latestData.ecgRate) query.append('ecgRate', latestData.ecgRate.toString());
    if (latestData.estimatedBp) query.append('estimatedBp', latestData.estimatedBp);

    // ลบ lead1, lead2, lead3 ออกจาก URL
    // ECG และ Murmur ไหลผ่าน Context อัตโนมัติ

    router.push(`/data-entry?${query.toString()}`);
  };

  return (
    <Card className="rounded-xl border-0 shadow-sm">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
        <p className="text-sm text-muted-foreground">
          Continue to patient details with the latest readings.
        </p>
        <Button onClick={handleSendData} variant="outline" size="sm">
          <Send className="mr-2 h-4 w-4" />
          Open data entry
        </Button>
      </CardContent>
    </Card>
  );
}
