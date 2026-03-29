
'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/context/language-context";

const translations = {
  th: {
    title: "สรุปสุขภาพหัวใจ",
    description: "ส่วนนี้สำหรับแสดงภาพรวมและแดชบอร์ด",
  },
  en: {
    title: "Cardiac Summary",
    description: "This section is for displaying overviews and dashboards.",
  }
}

export default function DashboardPage() {
  const { lang } = useLanguage();
  const t = translations[lang];
  return (
    <div className="flex justify-center items-center h-full">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{t.description}</p>
        </CardContent>
      </Card>
    </div>
  );
}
