
"use client";

import CardioCapForm from "@/components/cardiocap-form";
import { useLanguage } from "@/context/language-context";

const translations = {
  th: {
    title: "CardioCap",
    description: "กรอกข้อมูลหัวใจและหลอดเลือดของคุณด้านล่าง AI ของเราจะทำการประเมินความเสี่ยงเบื้องต้น นี่ไม่ใช่สิ่งทดแทนคำแนะนำทางการแพทย์จากผู้เชี่ยวชาญ",
  },
  en: {
    title: "CardioCap",
    description: "Enter your cardiovascular data below. Our AI will provide a preliminary risk assessment. This is not a substitute for professional medical advice.",
  }
}

export default function DataEntryPage() {
  const { lang } = useLanguage();
  const t = translations[lang];
  return (
    <div className="w-full flex flex-col items-center">
       <div className="w-full max-w-4xl">
         <h2 className="text-3xl font-bold tracking-tight text-center">{t.title}</h2>
         <p className="mt-2 mb-8 max-w-prose text-center text-muted-foreground mx-auto">
            {t.description}
         </p>
         <CardioCapForm />
       </div>
    </div>
  );
}
