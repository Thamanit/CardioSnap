'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

  const handleSendData = () => {
    const query = new URLSearchParams();

    // Append only the relevant, latest data
    if (latestData.bpm) query.append('ppgHeartRate', latestData.bpm.toString());
    if (latestData.spo2) query.append('oxygenSaturation', latestData.spo2.toString());
    if (latestData.temp) query.append('bodyTemp', latestData.temp.toString());
    if (latestData.ecgRate) query.append('ecgRate', latestData.ecgRate.toString());
    if (latestData.lead1) query.append('ecgLead1', latestData.lead1.toString());
    if (latestData.lead2) query.append('ecgLead2', latestData.lead2.toString());
    if (latestData.lead3) query.append('ecgLead3', latestData.lead3.toString());
    if (latestData.estimatedBp) query.append('estimatedBp', latestData.estimatedBp);

    console.log("Sending data to form:", Object.fromEntries(query));

    router.push(`/data-entry?${query.toString()}`);
  };

  return (
    <Card>
        <CardHeader>
            <CardTitle>Proceed to Data Entry</CardTitle>
            <CardDescription>When you have finished collecting sensor data, click the button below to proceed to the patient data entry form. The latest sensor readings will be sent automatically.</CardDescription>
        </CardHeader>
        <CardContent>
            <Button onClick={handleSendData} className="w-full text-lg">
                <Send className="mr-2 h-5 w-5"/>
                Send Data and Open Form
            </Button>
        </CardContent>
    </Card>
  );
}
