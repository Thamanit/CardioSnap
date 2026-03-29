'use client';

import { BleSensorCard } from '@/components/ble-sensor-card';
import { EcgSensorCard } from '@/components/ecg-sensor-card';
import { NailfoldSensorCard } from '@/components/nailfold-sensor-card';
import { StethoscopeSensorCard } from '@/components/stethoscope-sensor-card';
import ClickToTwoPage from '@/components/clicktotwopage';

export default function OpenSensorPage() {
  return (
    <div className="w-full space-y-8">
        <BleSensorCard />
        <EcgSensorCard />
        <StethoscopeSensorCard />
        {/* <NailfoldSensorCard /> */}
        <ClickToTwoPage />
    </div>
  );
}
