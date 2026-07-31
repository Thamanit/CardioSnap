"use server";

import {
  riskFactorAnalysis,
  type RiskFactorAnalysisInput,
  type RiskFactorAnalysisOutput,
} from "@/ai/flows/risk-factor-analysis";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase";

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const FLASK_BASE =
  process.env.FLASK_API_URL ?? "https://thamanit-cardiosnap.hf.space";

// ─────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────

const FormSchema = z.object({
  patientName: z.string().optional(),
  hnId: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  age: z.string().optional(),
  isSmoker: z.boolean().optional(),
  hasDiabetes: z.boolean().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
  bmi: z.string().optional(),
  examDate: z.string().optional(),
  examTime: z.string().optional(),
  examinerType: z.enum(["self", "professional"]).optional(),
  examinerName: z.string().optional(),

  // ECG fields
  ecgRate: z.string().optional(),
  ecgRhythm: z.string().optional(),
  ecgConduction: z.string().optional(),
  sttChanges: z.string().optional(),
  qtInterval: z.string().optional(),
  qtcInterval: z.string().optional(),
  pvcBurden: z.string().optional(),
  pacBurden: z.string().optional(),
  artifactLevel: z.string().optional(),

  // PCG / Stethoscope fields
  s1Intensity: z.string().optional(),
  s2Intensity: z.string().optional(),
  murmurDetection: z.boolean().optional(),
  murmurGrade: z.string().optional(),
  murmurPosition: z.string().optional(),
  extraHeartSounds: z.array(z.string()).optional(),

  // PPG fields
  ppgHeartRate: z.union([z.string(), z.number()]).optional(),
  oxygenSaturation: z.coerce.number(),
  estimatedBp: z.string().optional(),
  hrv: z.union([z.string(), z.number()]).optional(),
  bodyTemp: z.union([z.string(), z.number()]).optional(),
  arterialStiffness: z.string().optional(),

  // Raw sensor data
  ecgLead1: z.union([z.number(), z.array(z.number())]).optional().default(0.1),
  ecgLead2: z.union([z.number(), z.array(z.number())]).optional().default(0.1),
  ecgLead3: z.union([z.number(), z.array(z.number())]).optional().default(0.1),
});

// ─────────────────────────────────────────────
// MAIN RISK ANALYSIS ACTION
// ─────────────────────────────────────────────

export async function getRiskAnalysis(
  data: z.infer<typeof FormSchema>
): Promise<{ success: boolean; data?: RiskFactorAnalysisOutput; error?: string }> {
  try {
    let lead1Data: any = data.ecgLead1;
    let lead2Data: any = data.ecgLead2;
    let lead3Data: any = data.ecgLead3;

    // ECG classification via Flask if raw arrays provided
    let ecgClassLabel: string | null = null;
    if (
      Array.isArray(lead1Data) &&
      Array.isArray(lead2Data) &&
      Array.isArray(lead3Data)
    ) {
      const ecgClassification = await classifyEcg({
        lead1: lead1Data,
        lead2: lead2Data,
        lead3: lead3Data,
      });

      ecgClassLabel = ecgClassification.overall_prediction;
      lead1Data = ecgClassification.overall_prediction;
      lead2Data = ecgClassification.overall_prediction;
      lead3Data = ecgClassification.overall_prediction;
    } else {
      lead1Data = typeof lead1Data === "number" ? lead1Data : parseFloat(lead1Data);
      lead2Data = typeof lead2Data === "number" ? lead2Data : parseFloat(lead2Data);
      lead3Data = typeof lead3Data === "number" ? lead3Data : parseFloat(lead3Data);
    }

    const validatedData: RiskFactorAnalysisInput = {
      ecgLead1: lead1Data,
      ecgLead2: lead2Data,
      ecgLead3: lead3Data,
      oxygenSaturation: data.oxygenSaturation,
    };

    console.log("validatedData:", validatedData);

    // Run AI analysis
    const result = await riskFactorAnalysis(validatedData);

    // Determine risk level
    let riskLevel = 1;
    if (result.heartFailureRisk.level === "moderate") riskLevel = 2;
    if (result.heartFailureRisk.level === "high") riskLevel = 3;
    if (result.overallSummary.overallAssessment === "consult_specialist") riskLevel = 4;

    // ─── Persist to Supabase ───
    const supabase = createServerSupabaseClient();

    // 1. Insert patient
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .insert({
        name: data.patientName ?? null,
        gender: data.gender ?? null,
        age: data.age ? parseInt(data.age, 10) : null,
        weight: data.weight ? parseFloat(data.weight) : null,
        height: data.height ? parseInt(data.height, 10) : null,
        bmi: data.bmi ? parseFloat(data.bmi) : null,
        smoking: data.isSmoker ?? false,
        diabetes: data.hasDiabetes ?? false,
      })
      .select("patient_id")
      .single();

    if (patientError) {
      console.error("Error inserting patient:", patientError);
      // Continue even if patient insert fails — still return AI result
    }

    const patientId = patient?.patient_id;

    // 2. Insert examination
    let examId: number | null = null;
    if (patientId) {
      const examDatetime =
        data.examDate && data.examTime
          ? new Date(`${data.examDate}T${data.examTime}`).toISOString()
          : new Date().toISOString();

      const { data: exam, error: examError } = await supabase
        .from("examinations")
        .insert({
          patient_id: patientId,
          exam_datetime: examDatetime,
          exam_type: data.examinerType ?? "self",
          notes: data.examinerName ? `Examiner: ${data.examinerName}` : null,
        })
        .select("exam_id")
        .single();

      if (examError) {
        console.error("Error inserting examination:", examError);
      } else {
        examId = exam?.exam_id;
      }
    }

    // 3. Insert sensor results (parallel)
    if (examId) {
      // ECG results
      const ecgInsert = supabase.from("ecg_results").insert({
        exam_id: examId,
        heart_rate: data.ecgRate ? parseInt(data.ecgRate, 10) : null,
        rhythm: data.ecgRhythm ?? null,
        pr_interval: null, // Derived from ecgConduction if needed
        qrs_duration: null,
        qt: data.qtInterval ? parseInt(data.qtInterval, 10) : null,
        qtc: data.qtcInterval ? parseInt(data.qtcInterval, 10) : null,
        st_status: data.sttChanges ?? null,
        pvc_percent: data.pvcBurden ? parseFloat(data.pvcBurden) : null,
        pac_percent: data.pacBurden ? parseFloat(data.pacBurden) : null,
        signal_quality: data.artifactLevel ?? null,
      }).then(res => { if (res.error) throw res.error; return res; });

      // PPG results
      const parseBp = (bp: string | undefined): { sbp: number | null; dbp: number | null } => {
        if (!bp) return { sbp: null, dbp: null };
        const match = bp.match(/(\d+)\s*\/\s*(\d+)/);
        if (match) return { sbp: parseInt(match[1], 10), dbp: parseInt(match[2], 10) };
        return { sbp: null, dbp: null };
      };
      const { sbp, dbp } = parseBp(data.estimatedBp);

      const ppgEcgInsert = supabase.from("ppg_ecg_results").insert({
        exam_id: examId,
        hr: data.ppgHeartRate ? parseInt(String(data.ppgHeartRate), 10) : null,
        spo2: Math.round(data.oxygenSaturation),
        sbp,
        dbp,
        hrv: data.hrv ? parseInt(String(data.hrv), 10) : null,
        temperature: data.bodyTemp ? parseFloat(String(data.bodyTemp)) : null,
        arterial_stiffness: data.arterialStiffness ? parseFloat(data.arterialStiffness) : null,
      }).then(res => { if (res.error) throw res.error; return res; });

      const ppgInsert = supabase.from("ppg_results").insert({
        exam_id: examId,
        hr: data.ppgHeartRate ? parseInt(String(data.ppgHeartRate), 10) : null,
        spo2: Math.round(data.oxygenSaturation),
        sbp,
        dbp,
        hrv: data.hrv ? parseInt(String(data.hrv), 10) : null,
        temperature: data.bodyTemp ? parseFloat(String(data.bodyTemp)) : null,
        arterial_stiffness: data.arterialStiffness ? parseFloat(data.arterialStiffness) : null,
      }).then(res => { if (res.error) throw res.error; return res; });

      // PCG results (stethoscope)
      const extraSounds = data.extraHeartSounds ?? [];
      const pcgInsert = supabase.from("pcg_results").insert({
        exam_id: examId,
        s1_intensity: data.s1Intensity ? parseFloat(data.s1Intensity) || null : null,
        s2_intensity: data.s2Intensity ? parseFloat(data.s2Intensity) || null : null,
        murmur: data.murmurDetection ?? false,
        murmur_grade: data.murmurGrade ? parseInt(data.murmurGrade, 10) || null : null,
        murmur_type: data.murmurPosition ?? null,
        s3: extraSounds.includes("s3_gallop"),
        s4: extraSounds.includes("s4_gallop"),
      }).then(res => { if (res.error) throw res.error; return res; });

      const results = await Promise.allSettled([ecgInsert, ppgEcgInsert, ppgInsert, pcgInsert]);
      for (const r of results) {
        if (r.status === "rejected") {
          console.error("Error inserting sensor result:", r.reason);
        }
      }

      // 4. Insert AI results
      const { error: aiError } = await supabase.from("ai_results").insert({
        exam_id: examId,
        ecg_class: ecgClassLabel ?? null,
        pcg_class: result.stethoscopeAbnormalities.murmur.detected ? "Murmur" : "Normal",
        bp_category: null,
        heart_risk: result.heartFailureRisk.level,
        confidence_score: null,
      });

      if (aiError) {
        console.error("Error inserting AI results:", aiError);
      }
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("Error in getRiskAnalysis action:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return { success: false, error: errorMessage };
  }
}

// ─────────────────────────────────────────────
// ECG ARRHYTHMIA CLASSIFICATION
// POST /ecg-model
// Body: { lead1: number[], lead2: number[], lead3: number[] }
// ─────────────────────────────────────────────

export async function classifyEcg(ecgData: {
  lead1: number[];
  lead2: number[];
  lead3: number[];
}): Promise<{
  overall_prediction: string;
  average_probabilities: Record<string, number>;
  num_beats_detected?: number;
  leads_used?: string[];
}> {
  try {
    const onlyLead2 = {
      lead2: ecgData.lead2
    }
    
    console.log(JSON.stringify(onlyLead2))

    const response = await fetch(`${FLASK_BASE}/ecg-model`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(onlyLead2),
    });

    if (!response.ok) {
      throw new Error(`ECG model error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.warn(
      "ECG classification from Flask failed, proceeding with default values:",
      error
    );
    return {
      overall_prediction: "Normal Beat",
      average_probabilities: { "Normal Beat": 1.0 },
    };
  }
}

// ─────────────────────────────────────────────
// MURMUR DETECTION
// POST /murmur-model   (multipart/form-data)
// Field: file = <heart_sound.wav>
// ─────────────────────────────────────────────

export type MurmurResult = {
  overall_prediction: "Normal" | "Murmur";
  average_probabilities: { Normal: number; Murmur: number };
  num_clips_analyzed: number;
  murmur_clips: number;
  normal_clips: number;
  denoise_applied: boolean;
  per_clip: Array<{
    clip_index: number;
    prediction: string;
    probabilities: { Normal: number; Murmur: number };
  }>;
};

export async function classifyMurmur(
  wavFile: File
): Promise<{ success: boolean; data?: MurmurResult; error?: string }> {
  try {
    if (!wavFile.name.toLowerCase().endsWith(".wav")) {
      return { success: false, error: "Only .wav files are supported for murmur detection." };
    }

    const formData = new FormData();
    formData.append("file", wavFile);

    const response = await fetch(`${FLASK_BASE}/murmur-model`, {
      method: "POST",
      body: formData,
      // Do NOT set Content-Type — browser sets multipart boundary automatically
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Murmur model error ${response.status}: ${errBody}`);
    }

    const data: MurmurResult = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("Murmur classification failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Murmur classification failed.",
    };
  }
}

// ─────────────────────────────────────────────
// BLOOD PRESSURE (ECG + PPG)
// POST /bp-model
// ─────────────────────────────────────────────

export type BPResult = {
  sbp: number;
  dbp: number;
  sbp_mean: number;
  dbp_mean: number;
  bpm: number | null;
  spo2: null;
  num_beats: number;
  model: string;
  per_beat: Array<{
    beat_index: number;
    sbp: number;
    dbp: number;
  }>;
};

export async function classifyBP(
  ecg: number[],
  ppg: number[],
  sampleRate: number = 125
): Promise<{ success: boolean; data?: BPResult; error?: string }> {
  try {
    if (ecg.length < 250 || ppg.length < 250) {
      return {
        success: false,
        error: "Signal too short — buffer at least 2 seconds of BLE packets.",
      };
    }

    const response = await fetch(`${FLASK_BASE}/bp-model`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ecg, ppg, sample_rate: sampleRate }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`BP model error ${response.status}: ${errBody}`);
    }

    const data: BPResult = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("BP classification failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "BP classification failed.",
    };
  }
}

// ─────────────────────────────────────────────
// DOCTOR COMMENT
// ─────────────────────────────────────────────

export async function saveDoctorComment(
  examId: number,
  comment: string,
  finalRiskLevel: number
) {
  try {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase
      .from("examinations")
      .update({
        notes: comment,
        exam_type: `reviewed-risk-${finalRiskLevel}`,
      })
      .eq("exam_id", examId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error saving doctor comment:", error);
    return { success: false, error: "Failed to save comment." };
  }
}
