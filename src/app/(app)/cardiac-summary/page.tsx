
'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/context/language-context";
import { UserCircle, Search, RefreshCw } from "lucide-react";
import Loading from "@/app/loading";

const translations = {
  th: {
    pageTitle: "Patient Assessment Queue",
    systemName: "ระบบสรุปผลการตรวจหัวใจและหลอดเลือดสำหรับแพทย์",
    description: "ตารางผู้ป่วยที่รอประเมิน (ข้อมูลใหม่จะแสดงด้านบนสุด)",
    table: {
      date: "วันที่ / เวลา",
      name: "ชื่อผู้ป่วย",
      hn: "HN / ID",
      risk: "ระดับความเสี่ยง",
      status: "สถานะ",
      action: "Action",
    },
    riskLevels: {
      1: "ระดับ 1 (ต่ำ)",
      2: "ระดับ 2 (ปานกลาง)",
      3: "ระดับ 3 (สูง)",
      4: "ระดับ 4 (วิกฤต)",
    },
    status: {
      pending: "รอประเมิน",
      reviewed: "ประเมินแล้ว",
    },
    action: "ดูรายละเอียด",
    riskLegend: {
      title: "สีระดับความเสี่ยง แนะนำ",
      level4: "ระดับ 4 = สีแดงเข้ม (Critical)",
      level3: "ระดับ 3 = สีส้ม (High)",
      level2: "ระดับ 2 = สีเหลือง (Moderate)",
      level1: "ระดับ 1 = สีเขียว (Low)",
    },
    loading: "กำลังโหลดข้อมูล...",
    noData: "ยังไม่มีข้อมูลการประเมิน",
    error: "ไม่สามารถโหลดข้อมูลได้",
    refresh: "รีเฟรช",
  },
  en: {
    pageTitle: "Patient Assessment Queue",
    systemName: "Cardiovascular Assessment Summary System for Physicians",
    description: "Patient assessment queue (newest data appears at the top).",
    table: {
      date: "Date / Time",
      name: "Patient Name",
      hn: "HN / ID",
      risk: "Risk Level",
      status: "Status",
      action: "Action",
    },
    riskLevels: {
      1: "Level 1 (Low)",
      2: "Level 2 (Moderate)",
      3: "Level 3 (High)",
      4: "Level 4 (Critical)",
    },
    status: {
      pending: "Pending",
      reviewed: "Reviewed",
    },
    action: "View Details",
    riskLegend: {
      title: "Recommended Risk Level Colors",
      level4: "Level 4 = Dark Red (Critical)",
      level3: "Level 3 = Orange (High)",
      level2: "Level 2 = Yellow (Moderate)",
      level1: "Level 1 = Green (Low)",
    },
    loading: "Loading data...",
    noData: "No assessment data available yet.",
    error: "Could not load data.",
    refresh: "Refresh",
  }
};

const getRiskInfo = (level: number, t: any) => {
  switch (level) {
    case 4: return { text: t.riskLevels[4], color: 'bg-red-100 text-red-800 border border-red-200', variant: 'outline' as const };
    case 3: return { text: t.riskLevels[3], color: 'bg-orange-100 text-orange-800 border border-orange-200', variant: 'outline' as const };
    case 2: return { text: t.riskLevels[2], color: 'bg-yellow-100 text-yellow-800 border border-yellow-200', variant: 'outline' as const };
    case 1: return { text: t.riskLevels[1], color: 'bg-green-100 text-green-800 border border-green-200', variant: 'outline' as const };
    default: return { text: 'Unknown', color: 'bg-gray-100 text-gray-800', variant: 'secondary' as const };
  }
};

const getStatusInfo = (status: 'pending' | 'reviewed', t: any) => {
  switch (status) {
    case 'pending': return { text: t.status.pending, variant: 'secondary' as const };
    case 'reviewed': return { text: t.status.reviewed, variant: 'default' as const };
    default: return { text: 'Unknown', variant: 'secondary' as const };
  }
};

// --- Mock Data ---
const mockAssessments = [
  {
    id: '1',
    submissionTimestamp: new Date('2025-01-12T09:21:00'),
    patientName: 'นาย A',
    patientId: '225-99812',
    riskLevel: 3,
    status: 'pending' as const,
  },
  {
    id: '2',
    submissionTimestamp: new Date('2025-01-11T14:55:00'),
    patientName: 'นาย B',
    patientId: '117-88291',
    riskLevel: 2,
    status: 'reviewed' as const,
  },
  {
    id: '3',
    submissionTimestamp: new Date('2025-01-11T09:32:00'),
    patientName: 'นางสาว C',
    patientId: '892-28918',
    riskLevel: 1,
    status: 'pending' as const,
  },
];
// --- End Mock Data ---


export default function CardiacSummaryPage() {
  const { lang } = useLanguage();
  const { user, isUserLoading } = useUser();
  const t = translations[lang];

  if (isUserLoading) {
    return <Loading />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{t.pageTitle}</h1>
          <p className="text-muted-foreground">{t.systemName}</p>
          <p className="text-sm text-muted-foreground">{t.description}</p>
        </div>
        <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2 bg-muted p-2 rounded-md">
                <UserCircle className="h-6 w-6 text-muted-foreground" />
                <span className="font-medium text-sm text-foreground">{user.displayName}</span>
              </div>
            )}
             <Button variant="outline" onClick={() => window.location.reload()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t.refresh}
             </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.table.date}</TableHead>
                <TableHead>{t.table.name}</TableHead>
                <TableHead>{t.table.hn}</TableHead>
                <TableHead>{t.table.risk}</TableHead>
                <TableHead>{t.table.status}</TableHead>
                <TableHead>{t.table.action}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockAssessments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">{t.noData}</TableCell>
                </TableRow>
              )}
              {mockAssessments.map((item) => {
                  const riskInfo = getRiskInfo(item.riskLevel, t);
                  const statusInfo = getStatusInfo(item.status, t);
                  const formattedDate = format(item.submissionTimestamp, 'dd/MM/yyyy HH:mm', { locale: lang === 'th' ? th : undefined });
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-teal-700">{formattedDate}</TableCell>
                      <TableCell className="text-teal-700">{item.patientName}</TableCell>
                      <TableCell className="text-teal-700">{item.patientId}</TableCell>
                      <TableCell>
                        <Badge variant={riskInfo.variant} className={riskInfo.color}>{riskInfo.text}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>{statusInfo.text}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                           <Link href={{
                                pathname: `/patient-detail/${item.id}`,
                                query: { 
                                    name: item.patientName,
                                    date: formattedDate
                                }
                           }}>
                                <Search className="mr-2 h-4 w-4" />
                                {t.action}
                           </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
       <Card>
            <CardHeader><CardTitle className="text-base">{t.riskLegend.title}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-red-700"></div><span>{t.riskLegend.level4}</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-orange-500"></div><span>{t.riskLegend.level3}</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-yellow-500"></div><span>{t.riskLegend.level2}</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-green-600"></div><span>{t.riskLegend.level1}</span></div>
            </CardContent>
       </Card>

    </div>
  );
}

    