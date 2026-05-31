"use server";

import {
  riskFactorAnalysis,
  type RiskFactorAnalysisInput,
  type RiskFactorAnalysisOutput,
} from "@/ai/flows/risk-factor-analysis";
import { z } from "zod";
import { initializeFirebase } from "@/firebase/server-init";

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
  ecgLead1: z.union([z.number(), z.array(z.number())]).optional().default(0.1),
  ecgLead2: z.union([z.number(), z.array(z.number())]).optional().default(0.1),
  ecgLead3: z.union([z.number(), z.array(z.number())]).optional().default(0.1),
  oxygenSaturation: z.coerce.number(),
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

    const result = await riskFactorAnalysis(validatedData);

    const { firestore } = initializeFirebase();
    const assessmentsCollection = firestore.collection("patient_assessments");

    let riskLevel = 1;
    if (result.heartFailureRisk.level === "moderate") riskLevel = 2;
    if (result.heartFailureRisk.level === "high") riskLevel = 3;
    if (result.overallSummary.overallAssessment === "consult_specialist") riskLevel = 4;

    // const { serverTimestamp } = await import("firebase-admin/firestore");

    await assessmentsCollection.add({
      patientName: data.patientName,
      patientId: data.hnId,
      patientAge: data.age,
      patientGender: data.gender,
      // submissionTimestamp: serverTimestamp(),
      riskLevel: riskLevel,
      status: "pending",
      aiAnalysis: result,
      doctorComment: "",
    });

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
//
// Body (JSON):
//   {
//     "ecg":         number[],   ← raw ADC values from ECG_PIN  (125 Hz)
//     "ppg":         number[],   ← raw IR values from MAX30102  (125 Hz)
//     "sample_rate": 125         ← optional, default 125
//   }
//
// How to build the arrays on the client:
//   Buffer BLE packets for 10–15 seconds, then:
//     ecg[] = packets.map(p => p.ecg)
//     ppg[] = packets.map(p => p.ir)
// ─────────────────────────────────────────────

export type BPResult = {
  sbp: number;                // Systolic BP  — median across beats (mmHg)
  dbp: number;                // Diastolic BP — median across beats (mmHg)
  sbp_mean: number;           // Systolic BP  — mean  across beats (mmHg)
  dbp_mean: number;           // Diastolic BP — mean  across beats (mmHg)
  bpm: number | null;         // Heart rate estimated from PPG
  spo2: null;                 // Always null for /bp-model (no RED channel)
  num_beats: number;          // Number of beats detected
  model: string;              // "BPNet1D"
  per_beat: Array<{
    beat_index: number;
    sbp: number;
    dbp: number;
  }>;
};

export async function classifyBP(
  ecg: number[],   // raw ECG ADC samples at 125 Hz  (from packet.ecg)
  ppg: number[],   // raw IR samples at 125 Hz        (from packet.ir)
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
  assessmentId: string,
  comment: string,
  finalRiskLevel: number
) {
  try {
    const { firestore } = initializeFirebase();
    const assessmentRef = firestore
      .collection("patient_assessments")
      .doc(assessmentId);
    await assessmentRef.update({
      doctorComment: comment,
      status: "reviewed",
      doctorFinalRiskLevel: finalRiskLevel,
    });
    return { success: true };
  } catch (error) {
    console.error("Error saving doctor comment:", error);
    return { success: false, error: "Failed to save comment." };
  }
}