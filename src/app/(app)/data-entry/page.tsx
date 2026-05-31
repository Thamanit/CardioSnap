
"use client";

import { useSearchParams } from "next/navigation";
import CardioCapForm from "@/components/cardiocap-form";
import { useLanguage } from "@/context/language-context";

const translations = {
  th: {
    title: "CardioSnap",
    description: "กรอกข้อมูลหัวใจและหลอดเลือดของคุณด้านล่าง AI ของเราจะทำการประเมินความเสี่ยงเบื้องต้น นี่ไม่ใช่สิ่งทดแทนคำแนะนำทางการแพทย์จากผู้เชี่ยวชาญ",
  },
  en: {
    title: "CardioSnap",
    description: "Enter your cardiovascular data below. Our AI will provide a preliminary risk assessment. This is not a substitute for professional medical advice.",
  }
}

export default function DataEntryPage() {
  const { lang } = useLanguage();
  const t = translations[lang];
  const searchParams = useSearchParams();

  // Extract sensor data from URL query parameters
  const sensorData = {
    ppgHeartRate: searchParams.get('ppgHeartRate') || '',
    oxygenSaturation: searchParams.get('oxygenSaturation') || '',
    estimatedBp: searchParams.get('estimatedBp') || '',
    bodyTemp: searchParams.get('bodyTemp') || '',
    ecgRate: searchParams.get('ecgRate') || '',
    ecgLead1: searchParams.get('ecgLead1') || '',
    ecgLead2: searchParams.get('ecgLead2') || '',
    ecgLead3: searchParams.get('ecgLead3') || '',
  };

  return (
    <div className="w-full flex flex-col items-center">
       <div className="w-full max-w-4xl">
         <h2 className="text-3xl font-bold tracking-tight text-center">{t.title}</h2>
         <p className="mt-2 mb-8 max-w-prose text-center text-muted-foreground mx-auto">
            {t.description}
         </p>
         <CardioCapForm initialSensorData={sensorData} />
       </div>
    </div>
  );
}
