"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Loader2,
  WandSparkles,
  HeartPulse,
  LineChart,
  Waves,
  User,
  Stethoscope,
  ShieldAlert,
  ClipboardList,
  HeartHandshake,
  Printer,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRiskAnalysis } from "@/firebase/actions";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "./ui/separator";
import { Checkbox } from "./ui/checkbox";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type { RiskFactorAnalysisOutput } from "@/ai/flows/risk-factor-analysis";
import { Badge } from "./ui/badge";
import { translations } from "@/lib/translations";
import { useUser } from "@/firebase";
import { useLanguage } from "@/context/language-context";
import { useEcgRecording } from "@/context/ecg-context";
import { useMurmurRecording } from "@/context/murmur-context";

const formSchema = z.object({
  // Section 1: Patient Information
  patientName: z.string().optional(),
  hnId: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  age: z.string().optional(),
  isSmoker: z.boolean().optional(),
  hasDiabetes: z.boolean().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
  bmi: z.string().optional(),
  insurance: z.enum(["uc", "social", "government", "other"]).optional(),
  examDate: z.string().optional(),
  examTime: z.string().optional(),
  examinerType: z.enum(["self", "professional"]).optional(),
  examinerName: z.string().optional(),

  // Section 2: 3-lead ECG Sensor
  ecgRate: z.string().optional(),
  ecgRhythm: z.enum(["sinus_rhythm", "sinus_tachycardia", "sinus_bradycardia", "atrial_fibrillation", "irregular_rhythm"]).optional(),
  ecgConduction: z.enum(["normal", "prolonged_pr", "bundle_branch_block"]).optional(),
  bundleBranchBlockDetail: z.string().optional(),
  sttChanges: z.enum(["normal", "st_depression", "st_elevation", "t_wave_inversion"]).optional(),
  qtInterval: z.string().optional(),
  qtcInterval: z.string().optional(),
  qtcMethod: z.string().optional(),
  pvcBurden: z.string().optional(),
  pacBurden: z.string().optional(),
  artifactLevel: z.enum(["low", "medium", "high"]).optional(),
  noiseSource: z.array(z.string()).optional(),

  // Section 3: Stethoscope Sensor
  s1Intensity: z.string().optional(),
  s2Intensity: z.string().optional(),
  murmurDetection: z.boolean().optional(),
  murmurGrade: z.enum(["I", "II", "III", "IV", "V"]).optional(),
  murmurPosition: z.enum(["aortic", "pulmonic", "tricuspid", "mitral"]).optional(),
  extraHeartSounds: z.array(z.string()).optional(),
  rhythmCharacteristics: z.enum(["regular", "irregular", "variable_intensity"]).optional(),

  // Section 4: PPG Sensor
  ppgHeartRate: z.string().optional(),
  oxygenSaturation: z.string().min(1, "Oxygen Saturation is required."),
  estimatedBp: z.string().optional(),
  hrv: z.string().optional(),
  bodyTemp: z.string().optional(),
  arterialStiffness: z.string().optional(),
  ppgAbnormalPulse: z.array(z.string()).optional(),

  // Original required fields
  ecgLead1: z.string().min(1, "ECG Lead I is required."),
  ecgLead2: z.string().min(1, "ECG Lead II is required."),
  ecgLead3: z.string().min(1, "ECG Lead III is required."),
  murmurAudioData: z.string().optional(),
});

type AnalysisResult = {
  analysis?: RiskFactorAnalysisOutput;
  error?: string;
};

interface CardioCapFormProps {
  initialSensorData?: {
    ppgHeartRate?: string;
    oxygenSaturation?: string;
    estimatedBp?: string;
    bodyTemp?: string;
    ecgRate?: string;
    ecgLead1?: string;
    ecgLead2?: string;
    ecgLead3?: string;
  };
}

const ResultDisplayItem: React.FC<{ label: string; value: React.ReactNode; sub?: boolean }> = ({
  label,
  value,
  sub = false,
}) => (
  <div className={`flex justify-between items-start text-sm ${sub ? "pl-4" : ""}`}>
    <p className="text-muted-foreground">{label}:</p>
    <p className="text-right font-medium text-foreground">{String(value)}</p>
  </div>
);

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  title,
  icon,
  children
}) => (
  <Card>
    <CardHeader className="pb-4">
      <CardTitle className="text-lg flex items-center gap-2">
        {icon} {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-2 text-sm">
      {children}
    </CardContent>
  </Card>
);

export default function CardioCapForm({ initialSensorData }: CardioCapFormProps) {
  const { lang } = useLanguage();
  const t = translations[lang];
  const { user } = useUser();
  const { recording, clearRecording } = useEcgRecording();
  const { recording: murmurRecording, clearRecording: clearMurmurRecording } = useMurmurRecording();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patientName: '',
      hnId: '',
      age: '',
      weight: '',
      height: '',
      bmi: '',
      examDate: '',
      examTime: '',
      examinerName: '',
      ecgRate: '',
      bundleBranchBlockDetail: '',
      qtInterval: '',
      qtcInterval: '',
      qtcMethod: '',
      pvcBurden: '',
      pacBurden: '',
      s1Intensity: '',
      s2Intensity: '',
      ppgHeartRate: '',
      oxygenSaturation: "",
      estimatedBp: '',
      hrv: '',
      bodyTemp: '',
      arterialStiffness: '',
      ecgLead1: "",
      ecgLead2: "",
      ecgLead3: "",
      murmurAudioData: "",
      isSmoker: false,
      hasDiabetes: false,
      murmurDetection: false,
      noiseSource: [],
      extraHeartSounds: [],
      ppgAbnormalPulse: [],
      examinerType: "self",
    },
  });

  const { watch, setValue, getValues, control } = form;
  const weight = watch("weight");
  const height = watch("height");
  const murmurDetected = watch("murmurDetection");
  const conduction = watch("ecgConduction");
  const examinerType = watch("examinerType");

  useEffect(() => {
    if (examinerType === "self" && user?.displayName) {
      setValue("patientName", user.displayName);
    } else if (examinerType === "self") {
      setValue("patientName", "Anonymous User");
    } else {
      setValue("patientName", "");
    }
  }, [examinerType, user, setValue]);

  useEffect(() => {
    const weightNum = parseFloat(weight || "0");
    const heightNum = parseFloat(height || "0");

    if (weightNum > 0 && heightNum > 0) {
      const heightInMeters = heightNum / 100;
      const bmi = weightNum / (heightInMeters * heightInMeters);
      setValue("bmi", bmi.toFixed(2));
    } else {
      setValue("bmi", "");
    }
  }, [weight, height, setValue]);

  // Fill form with initial sensor data from URL parameters
  useEffect(() => {
    if (initialSensorData) {
      if (initialSensorData.ppgHeartRate) setValue("ppgHeartRate", initialSensorData.ppgHeartRate);
      if (initialSensorData.oxygenSaturation) setValue("oxygenSaturation", initialSensorData.oxygenSaturation);
      if (initialSensorData.estimatedBp) setValue("estimatedBp", initialSensorData.estimatedBp);
      if (initialSensorData.bodyTemp) setValue("bodyTemp", initialSensorData.bodyTemp);
      if (initialSensorData.ecgRate) setValue("ecgRate", initialSensorData.ecgRate);
      if (initialSensorData.ecgLead1) setValue("ecgLead1", initialSensorData.ecgLead1);
      if (initialSensorData.ecgLead2) setValue("ecgLead2", initialSensorData.ecgLead2);
      if (initialSensorData.ecgLead3) setValue("ecgLead3", initialSensorData.ecgLead3);

      toast({
        title: "Sensor Data Loaded",
        description: "Sensor values have been automatically filled into the form.",
      });
    }
  }, [initialSensorData, setValue, toast]);

  // Auto-fill ECG data when recording is complete
  useEffect(() => {
    if (recording && recording.lead1.length > 0 && recording.lead2.length > 0 && recording.lead3.length > 0) {
      // Generate realistic ECG values by averaging the recorded data
      const avgLead1 = recording.lead1.reduce((a, b) => a + b, 0) / recording.lead1.length;
      const avgLead2 = recording.lead2.reduce((a, b) => a + b, 0) / recording.lead2.length;
      const avgLead3 = recording.lead3.reduce((a, b) => a + b, 0) / recording.lead3.length;

      // Serialize the full arrays as JSON strings for the backend
      setValue("ecgLead1", JSON.stringify(recording.lead1));
      setValue("ecgLead2", JSON.stringify(recording.lead2));
      setValue("ecgLead3", JSON.stringify(recording.lead3));

      toast({
        title: "ECG Recording Loaded",
        description: "ECG data has been automatically filled into the form.",
      });

      clearRecording();
    }
  }, [recording, setValue, toast, clearRecording]);

  // Auto-fill Murmur data when recording is complete
  useEffect(() => {
    if (murmurRecording && murmurRecording.audioData.length > 0) {
      // Serialize the audio data as JSON string for the backend
      setValue("murmurAudioData", JSON.stringify(murmurRecording.audioData));

      toast({
        title: "Murmur Recording Loaded",
        description: "Murmur audio data has been automatically filled into the form.",
      });

      clearMurmurRecording();
    }
  }, [murmurRecording, setValue, toast, clearMurmurRecording]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    setResult(null);

    try {
      // Parse ECG data if they are JSON strings (from recording)
      let ecgLead1: any = values.ecgLead1;
      let ecgLead2: any = values.ecgLead2;
      let ecgLead3: any = values.ecgLead3;

      try {
        ecgLead1 = typeof ecgLead1 === 'string' ? JSON.parse(ecgLead1) : ecgLead1;
        ecgLead2 = typeof ecgLead2 === 'string' ? JSON.parse(ecgLead2) : ecgLead2;
        ecgLead3 = typeof ecgLead3 === 'string' ? JSON.parse(ecgLead3) : ecgLead3;
      } catch {
        // If parsing fails, try to convert to number
        ecgLead1 = typeof ecgLead1 === 'string' ? parseFloat(ecgLead1) : ecgLead1;
        ecgLead2 = typeof ecgLead2 === 'string' ? parseFloat(ecgLead2) : ecgLead2;
        ecgLead3 = typeof ecgLead3 === 'string' ? parseFloat(ecgLead3) : ecgLead3;
      }

      // Parse Murmur audio data
      let murmurAudioData: any = values.murmurAudioData;
      try {
        murmurAudioData = typeof murmurAudioData === 'string' && murmurAudioData ? JSON.parse(murmurAudioData) : murmurAudioData;
      } catch {
        murmurAudioData = undefined;
      }

      const submitData = {
        ...values,
        ecgLead1,
        ecgLead2,
        ecgLead3,
        murmurAudioData: murmurAudioData || undefined,
      };

      const response = await getRiskAnalysis(submitData as any);

      if (response.success && response.data) {
        setResult({ analysis: response.data });
        toast({
          title: "Analysis Complete",
          description: "The AI has successfully analyzed the provided data.",
        });
      } else {
        const errorMsg = response.error || t.toast.analysisErrorDefault;
        setResult({ error: errorMsg });
        toast({
          variant: "destructive",
          title: t.toast.analysisErrorTitle,
          description: errorMsg,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "An unexpected error occurred";
      setResult({ error: errorMsg });
      toast({
        variant: "destructive",
        title: t.toast.analysisErrorTitle,
        description: errorMsg,
      });
    }
    setIsSubmitting(false);
  }

  return (
    <div className="w-full max-w-4xl space-y-8">
      <Card className="w-full no-print">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>{t.form.title}</CardTitle>
              <CardDescription>
                {t.form.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Patient Information */}
              <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center"><User className="mr-2 h-5 w-5" />{t.patient.title}</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={control}
                    name="examinerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.patient.examinerRole}</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex items-center space-x-4"
                          >
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl><RadioGroupItem value="self" /></FormControl>
                              <FormLabel className="font-normal">{t.patient.examinerSelf}</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl><RadioGroupItem value="professional" /></FormControl>
                              <FormLabel className="font-normal">{t.patient.examinerProfessional}</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {examinerType === 'professional' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="patientName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.patient.name}</FormLabel>
                        <FormControl><Input placeholder={t.patient.namePlaceholder} {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="examinerName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.patient.examiner}</FormLabel>
                        <FormControl><Input placeholder={t.patient.examinerPlaceholder} {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                ) : (
                  <FormField control={form.control} name="patientName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.patient.name}</FormLabel>
                      <FormControl><Input placeholder={t.patient.namePlaceholder} {...field} readOnly className="bg-muted/50" /></FormControl>
                    </FormItem>
                  )} />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="hnId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.patient.hn}</FormLabel>
                      <FormControl><Input placeholder={t.patient.hnPlaceholder} {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="gender" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.patient.gender}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder={t.patient.genderPlaceholder} /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="male">{t.patient.male}</SelectItem>
                          <SelectItem value="female">{t.patient.female}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="age" render={({ field }) => (
                    <FormItem><FormLabel>{t.patient.age}</FormLabel><FormControl><Input type="number" placeholder={t.patient.agePlaceholder} {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <div className="flex items-center space-x-8">
                  <FormField control={form.control} name="isSmoker" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel>{t.patient.smoker}</FormLabel>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="hasDiabetes" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel>{t.patient.diabetes}</FormLabel>
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="weight" render={({ field }) => (
                    <FormItem><FormLabel>{t.patient.weight}</FormLabel><FormControl><Input type="number" placeholder="kg" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="height" render={({ field }) => (
                    <FormItem><FormLabel>{t.patient.height}</FormLabel><FormControl><Input type="number" placeholder="cm" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="bmi" render={({ field }) => (
                    <FormItem><FormLabel>BMI</FormLabel><FormControl><Input type="number" placeholder="BMI" {...field} readOnly className="bg-muted/50" /></FormControl></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="insurance" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.patient.insurance}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder={t.patient.insurancePlaceholder} /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="uc">{t.patient.uc}</SelectItem>
                          <SelectItem value="social">{t.patient.social}</SelectItem>
                          <SelectItem value="government">{t.patient.government}</SelectItem>
                          <SelectItem value="other">{t.patient.other}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="examDate" render={({ field }) => (
                    <FormItem><FormLabel>{t.patient.examDate}</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="examTime" render={({ field }) => (
                    <FormItem><FormLabel>{t.patient.examTime}</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>
                  )} />
                </div>
              </section>

              <Separator />

              {/* 3-lead ECG Sensor */}
              <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center"><LineChart className="mr-2 h-5 w-5" />{t.ecg.title}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="ecgRate" render={({ field }) => (
                    <FormItem><FormLabel>{t.ecg.rate}</FormLabel><FormControl><Input type="number" placeholder="bpm" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="ecgRhythm" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.ecg.rhythm}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder={t.ecg.rhythmPlaceholder} /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="sinus_rhythm">{t.ecg.rhythmOptions.sinus_rhythm}</SelectItem>
                          <SelectItem value="sinus_tachycardia">{t.ecg.rhythmOptions.sinus_tachycardia}</SelectItem>
                          <SelectItem value="sinus_bradycardia">{t.ecg.rhythmOptions.sinus_bradycardia}</SelectItem>
                          <SelectItem value="atrial_fibrillation">{t.ecg.rhythmOptions.atrial_fibrillation}</SelectItem>
                          <SelectItem value="irregular_rhythm">{t.ecg.rhythmOptions.irregular_rhythm}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="ecgConduction" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.ecg.conduction}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder={t.ecg.conductionPlaceholder} /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="normal">{t.ecg.conductionOptions.normal}</SelectItem>
                          <SelectItem value="prolonged_pr">{t.ecg.conductionOptions.prolonged_pr}</SelectItem>
                          <SelectItem value="bundle_branch_block">{t.ecg.conductionOptions.bundle_branch_block}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                {conduction === "bundle_branch_block" && (
                  <FormField control={form.control} name="bundleBranchBlockDetail" render={({ field }) => (
                    <FormItem className="pl-6"><FormLabel>{t.ecg.bundleBranchBlockDetail}</FormLabel><FormControl><Input placeholder={t.ecg.bundleBranchBlockDetailPlaceholder} {...field} /></FormControl></FormItem>
                  )} />
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="sttChanges" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.ecg.sttChanges}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder={t.ecg.sttChangesPlaceholder} /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="normal">{t.ecg.sttChangesOptions.normal}</SelectItem>
                          <SelectItem value="st_depression">{t.ecg.sttChangesOptions.st_depression}</SelectItem>
                          <SelectItem value="st_elevation">{t.ecg.sttChangesOptions.st_elevation}</SelectItem>
                          <SelectItem value="t_wave_inversion">{t.ecg.sttChangesOptions.t_wave_inversion}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <div>
                  <FormLabel>{t.ecg.qtInterval}</FormLabel>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <FormField control={form.control} name="qtInterval" render={({ field }) => (
                      <FormItem><FormLabel className="text-sm font-normal">{t.ecg.qt}</FormLabel><FormControl><Input type="number" placeholder="ms" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="qtcInterval" render={({ field }) => (
                      <FormItem><FormLabel className="text-sm font-normal">{t.ecg.qtc}</FormLabel><FormControl><Input type="number" placeholder="ms" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="qtcMethod" render={({ field }) => (
                      <FormItem><FormLabel className="text-sm font-normal">{t.ecg.qtcMethod}</FormLabel><FormControl><Input placeholder={t.ecg.qtcMethodPlaceholder} {...field} /></FormControl></FormItem>
                    )} />
                  </div>
                </div>
                <div>
                  <FormLabel>{t.ecg.extrasystoles}</FormLabel>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <FormField control={form.control} name="pvcBurden" render={({ field }) => (
                      <FormItem><FormLabel className="text-sm font-normal">{t.ecg.pvcBurden}</FormLabel><FormControl><Input type="number" placeholder="%" {...field} /></FormControl><FormDescription>{t.ecg.pvcBurdenDescription}</FormDescription></FormItem>
                    )} />
                    <FormField control={form.control} name="pacBurden" render={({ field }) => (
                      <FormItem><FormLabel className="text-sm font-normal">{t.ecg.pacBurden}</FormLabel><FormControl><Input type="number" placeholder="%" {...field} /></FormControl></FormItem>
                    )} />
                  </div>
                </div>
                <div>
                  <FormLabel>{t.ecg.signalQuality}</FormLabel>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <FormField control={form.control} name="artifactLevel" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-normal">{t.ecg.artifactLevel}</FormLabel>
                        <FormControl>
                          <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex items-center space-x-4">
                            <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="low" /></FormControl><FormLabel className="font-normal">{t.ecg.artifactOptions.low}</FormLabel></FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="medium" /></FormControl><FormLabel className="font-normal">{t.ecg.artifactOptions.medium}</FormLabel></FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="high" /></FormControl><FormLabel className="font-normal">{t.ecg.artifactOptions.high}</FormLabel></FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormDescription>{t.ecg.artifactDescription}</FormDescription>
                      </FormItem>
                    )} />
                    <FormItem>
                      <FormLabel className="text-sm font-normal">{t.ecg.noiseSource}</FormLabel>
                      <div className="flex items-center space-x-4 pt-2">
                        {t.ecg.noiseOptions.map((item) => (
                          <FormField
                            key={item.id}
                            control={form.control}
                            name="noiseSource"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(item.id)}
                                    onCheckedChange={(checked) => {
                                      const current = getValues("noiseSource") || [];
                                      return checked
                                        ? field.onChange([...current, item.id])
                                        : field.onChange(current.filter((value) => value !== item.id));
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">{item.label}</FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </FormItem>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                  <FormField control={form.control} name="ecgLead1" render={({ field }) => (
                    <FormItem>
                      <FormLabel>ECG Lead I (mV)</FormLabel>
                      <FormControl><Input type="number" step="any" placeholder="e.g., 0.1" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="ecgLead2" render={({ field }) => (
                    <FormItem>
                      <FormLabel>ECG Lead II (mV)</FormLabel>
                      <FormControl><Input type="number" step="any" placeholder="e.g., 0.5" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="ecgLead3" render={({ field }) => (
                    <FormItem>
                      <FormLabel>ECG Lead III (mV)</FormLabel>
                      <FormControl><Input type="number" step="any" placeholder="e.g., 0.4" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </section>

              <Separator />

              {/* Stethoscope Sensor */}
              <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center"><Stethoscope className="mr-2 h-5 w-5" />{t.stethoscope.title}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="s1Intensity" render={({ field }) => (
                    <FormItem><FormLabel>{t.stethoscope.s1Intensity}</FormLabel><FormControl><Input placeholder="S1" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="s2Intensity" render={({ field }) => (
                    <FormItem><FormLabel>{t.stethoscope.s2Intensity}</FormLabel><FormControl><Input placeholder="S2" {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="murmurDetection" render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0 pt-2">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel>{t.stethoscope.murmurDetection}</FormLabel>
                  </FormItem>
                )} />
                {murmurDetected && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                    <FormField control={form.control} name="murmurGrade" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.stethoscope.murmurGrade}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder={t.stethoscope.murmurGradePlaceholder} /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="I">Grade I</SelectItem>
                            <SelectItem value="II">Grade II</SelectItem>
                            <SelectItem value="III">Grade III</SelectItem>
                            <SelectItem value="IV">Grade IV</SelectItem>
                            <SelectItem value="V">Grade V</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="murmurPosition" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.stethoscope.murmurPosition}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder={t.stethoscope.murmurPositionPlaceholder} /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="aortic">{t.stethoscope.murmurPositionOptions.aortic}</SelectItem>
                            <SelectItem value="pulmonic">{t.stethoscope.murmurPositionOptions.pulmonic}</SelectItem>
                            <SelectItem value="tricuspid">{t.stethoscope.murmurPositionOptions.tricuspid}</SelectItem>
                            <SelectItem value="mitral">{t.stethoscope.murmurPositionOptions.mitral}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                )}
                <div>
                  <FormLabel>{t.stethoscope.extraHeartSounds}</FormLabel>
                  <div className="flex items-center space-x-8 pt-2">
                    {t.stethoscope.extraHeartSoundsOptions.map(item => (
                      <FormField
                        key={item.id}
                        control={form.control}
                        name="extraHeartSounds"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(item.id)}
                                onCheckedChange={(checked) => {
                                  const current = getValues("extraHeartSounds") || [];
                                  return checked
                                    ? field.onChange([...current, item.id])
                                    : field.onChange(
                                      current.filter((value) => value !== item.id)
                                    );
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">{item.label}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>
                <FormField control={form.control} name="rhythmCharacteristics" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.stethoscope.rhythmCharacteristics}</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex items-center space-x-4">
                        <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="regular" /></FormControl><FormLabel className="font-normal">{t.stethoscope.rhythmCharacteristicsOptions.regular}</FormLabel></FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="irregular" /></FormControl><FormLabel className="font-normal">{t.stethoscope.rhythmCharacteristicsOptions.irregular}</FormLabel></FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="variable_intensity" /></FormControl><FormLabel className="font-normal">{t.stethoscope.rhythmCharacteristicsOptions.variable_intensity}</FormLabel></FormItem>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )} />
              </section>

              <Separator />

              {/* PPG Sensor */}
              <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center"><Waves className="mr-2 h-5 w-5" />{t.ppg.title}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="ppgHeartRate" render={({ field }) => (
                    <FormItem><FormLabel>{t.ppg.hr}</FormLabel><FormControl><Input type="number" placeholder="bpm" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="oxygenSaturation" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">{t.ppg.spo2}</FormLabel>
                      <FormControl><Input type="number" step="0.1" placeholder="e.g., 98.5" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="estimatedBp" render={({ field }) => (
                    <FormItem><FormLabel>{t.ppg.bp}</FormLabel><FormControl><Input placeholder="e.g., 120 / 80 mmHg" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="hrv" render={({ field }) => (
                    <FormItem><FormLabel>{t.ppg.hrv}</FormLabel><FormControl><Input type="number" placeholder="ms" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="bodyTemp" render={({ field }) => (
                    <FormItem><FormLabel>{t.ppg.temp}</FormLabel><FormControl><Input type="number" step="0.1" placeholder="°C" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="arterialStiffness" render={({ field }) => (
                    <FormItem><FormLabel>{t.ppg.stiffness}</FormLabel><FormControl><Input placeholder={t.ppg.stiffnessPlaceholder} {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <div>
                  <FormLabel>{t.ppg.abnormalPulse}</FormLabel>
                  <div className="flex flex-wrap gap-x-8 gap-y-2 pt-2">
                    <FormField
                      control={form.control}
                      name="ppgAbnormalPulse"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={!field.value || field.value.length === 0}
                              onCheckedChange={(checked) => {
                                if (checked) field.onChange([]);
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">{t.ppg.abnormalPulseOptions.none}</FormLabel>
                        </FormItem>
                      )}
                    />
                    {t.ppg.abnormalPulseOptions.choices.map((item) => (
                      <FormField
                        key={item.id}
                        control={form.control}
                        name="ppgAbnormalPulse"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(item.id)}
                                onCheckedChange={(checked) => {
                                  const current = getValues("ppgAbnormalPulse") || [];
                                  return checked
                                    ? field.onChange([...current, item.id])
                                    : field.onChange(current.filter((value) => value !== item.id));
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">{item.label}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>
              </section>

            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t.form.submitButton.submitting}
                  </>
                ) : (
                  <>
                    <WandSparkles className="mr-2 h-4 w-4" />
                    {t.form.submitButton.idle}
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {result?.analysis && (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 printable-area">
          <Card className="mt-8 w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HeartPulse className="h-6 w-6 text-primary" />
                {t.results.title}
              </CardTitle>
              <CardDescription>
                {t.results.disclaimer}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard title={t.results.hfRisk.title} icon={<ShieldAlert className="text-destructive" />}>
                  <ResultDisplayItem label={t.results.hfRisk.risk} value={`${result.analysis.heartFailureRisk.percentage}% (${result.analysis.heartFailureRisk.level})`} />
                  <ResultDisplayItem label={t.results.hfRisk.classification} value={result.analysis.heartFailureClassification} />
                </SectionCard>

                <SectionCard title={t.results.summary.title} icon={<ClipboardList />}>
                  <ResultDisplayItem label={t.results.summary.largeVessels} value={result.analysis.overallSummary.largeVessels} />
                  <ResultDisplayItem label={t.results.summary.microcirculation} value={result.analysis.overallSummary.microcirculation} />
                  <ResultDisplayItem label={t.results.summary.myocardial} value={`EF = ${result.analysis.overallSummary.myocardialFunction.ef}% → ${result.analysis.overallSummary.myocardialFunction.summary}`} />
                  <ResultDisplayItem label={t.results.summary.valve} value={result.analysis.overallSummary.valveCondition} />
                  <ResultDisplayItem label={t.results.summary.electrical} value={result.analysis.overallSummary.electricalActivity} />
                  <div className="pt-2">
                    <Badge variant={t.results.assessmentMap[result.analysis.overallSummary.overallAssessment].variant}>
                      {t.results.assessmentMap[result.analysis.overallSummary.overallAssessment].text}
                    </Badge>
                  </div>
                </SectionCard>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <SectionCard title={t.results.ecg.title} icon={<LineChart />}>
                  <ResultDisplayItem label={t.results.ecg.abnormalHr} value={result.analysis.ecgAbnormalities.abnormalHeartRate} />
                  <ResultDisplayItem label={t.results.ecg.detectedRhythm} value={result.analysis.ecgAbnormalities.detectedRhythm} />
                  <p className="font-medium text-foreground pt-2">{t.results.ecg.conduction.title}</p>
                  <ResultDisplayItem label={t.results.ecg.conduction.pr} value={`${result.analysis.ecgAbnormalities.conductionAbnormality.prInterval} ms`} sub />
                  <ResultDisplayItem label={t.results.ecg.conduction.qrs} value={`${result.analysis.ecgAbnormalities.conductionAbnormality.qrsDuration} ms`} sub />
                  <ResultDisplayItem label={t.results.ecg.conduction.qt} value={`${result.analysis.ecgAbnormalities.conductionAbnormality.qtQtcProlongation} ms`} sub />
                  <ResultDisplayItem label={t.results.ecg.stt} value={result.analysis.ecgAbnormalities.sttAbnormalities} />
                  <p className="font-medium text-foreground pt-2">{t.results.ecg.ectopy.title}</p>
                  <ResultDisplayItem label={t.results.ecg.ectopy.pvc} value={`${result.analysis.ecgAbnormalities.ectopyArrhythmiaRisk.pvcBurden}%`} sub />
                  <ResultDisplayItem label={t.results.ecg.ectopy.pac} value={`${result.analysis.ecgAbnormalities.ectopyArrhythmiaRisk.pacBurden}%`} sub />
                  <ResultDisplayItem label={t.results.ecg.ectopy.couplet} value={result.analysis.ecgAbnormalities.ectopyArrhythmiaRisk.coupletTriplet} sub />
                  <ResultDisplayItem label={t.results.ecg.ectopy.vt} value={result.analysis.ecgAbnormalities.ectopyArrhythmiaRisk.nonSustainedVT} sub />
                </SectionCard>

                <SectionCard title={t.results.stethoscope.title} icon={<Stethoscope />}>
                  <ResultDisplayItem label={t.results.stethoscope.abnormalSound} value={result.analysis.stethoscopeAbnormalities.abnormalHeartSound} />
                  {result.analysis.stethoscopeAbnormalities.murmur.detected ? (
                    <>
                      <p className="font-medium text-foreground pt-2">{t.results.stethoscope.murmur.title}</p>
                      <ResultDisplayItem label={t.results.stethoscope.murmur.type} value={result.analysis.stethoscopeAbnormalities.murmur.type} sub />
                      <ResultDisplayItem label={t.results.stethoscope.murmur.position} value={result.analysis.stethoscopeAbnormalities.murmur.position} sub />
                      <ResultDisplayItem label={t.results.stethoscope.murmur.grade} value={result.analysis.stethoscopeAbnormalities.murmur.grade} sub />
                    </>
                  ) : <ResultDisplayItem label={t.results.stethoscope.murmur.title} value={t.results.stethoscope.murmur.notDetected} />}
                  <ResultDisplayItem label={t.results.stethoscope.extraSounds} value={result.analysis.stethoscopeAbnormalities.extraSounds.join(', ') || t.results.none} />
                  <p className="font-medium text-foreground pt-2">{t.results.stethoscope.otherFindings.title}</p>
                  <ResultDisplayItem label={t.results.stethoscope.otherFindings.clickSnap} value={result.analysis.stethoscopeAbnormalities.otherAcousticFindings.clickSnap} sub />
                  <ResultDisplayItem label={t.results.stethoscope.otherFindings.frictionRub} value={result.analysis.stethoscopeAbnormalities.otherAcousticFindings.frictionRub} sub />
                </SectionCard>

                <SectionCard title={t.results.ppg.title} icon={<Waves />}>
                  {result.analysis.ppgAbnormalities.hasAbnormality ? (
                    <>
                      {result.analysis.ppgAbnormalities.arrhythmia && <ResultDisplayItem label={t.results.ppg.arrhythmia} value={`HRV: ${result.analysis.ppgAbnormalities.hrv} ms`} />}
                      {result.analysis.ppgAbnormalities.lowSpO2 && <ResultDisplayItem label={t.results.ppg.lowSpo2} value={`SpO₂: ${result.analysis.ppgAbnormalities.spO2}%`} />}
                      {result.analysis.ppgAbnormalities.tachycardia && <ResultDisplayItem label={t.results.ppg.tachycardia} value={`HR: ${result.analysis.ppgAbnormalities.heartRate} bpm`} />}
                      {result.analysis.ppgAbnormalities.bradycardia && <ResultDisplayItem label={t.results.ppg.bradycardia} value={`HR: ${result.analysis.ppgAbnormalities.heartRate} bpm`} />}
                      {result.analysis.ppgAbnormalities.highArterialStiffness && <ResultDisplayItem label={t.results.ppg.stiffness} value={t.results.high} />}
                      {result.analysis.ppgAbnormalities.abnormalPulseShape !== "None" && <ResultDisplayItem label={t.results.ppg.abnormalPulse} value={result.analysis.ppgAbnormalities.abnormalPulseShape} />}
                    </>
                  ) : <p>{t.results.none}</p>}
                </SectionCard>
              </div>
            </CardContent>
            <CardFooter className="flex-col sm:flex-row gap-2 no-print">
              <Button variant="secondary" className="w-full sm:w-auto">
                <HeartHandshake className="mr-2 h-4 w-4" />
                {t.results.recommendationsButton}
              </Button>
              <Button onClick={() => window.print()} className="w-full sm:w-auto">
                <Printer className="mr-2 h-4 w-4" />
                {t.results.pdfButton}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {result?.error && (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="mt-8 w-full border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-6 w-6" />
                {t.toast.analysisErrorTitle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-destructive-foreground">{result.error}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
