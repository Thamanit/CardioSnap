
"use server";

import {
  riskFactorAnalysis,
  type RiskFactorAnalysisInput,
  type RiskFactorAnalysisOutput,
} from "@/ai/flows/risk-factor-analysis";
import { z } from "zod";
import { initializeFirebase } from "@/firebase/server-init";

const FormSchema = z.object({
  patientName: z.string().optional(),
  hnId: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  age: z.string().optional(),
  ecgLead1: z.union([z.number(), z.array(z.number())]),
  ecgLead2: z.union([z.number(), z.array(z.number())]),
  ecgLead3: z.union([z.number(), z.array(z.number())]),
  oxygenSaturation: z.coerce.number(),
});


export async function getRiskAnalysis(
  data: z.infer<typeof FormSchema>
): Promise<{ success: boolean; data?: RiskFactorAnalysisOutput; error?: string }> {
  try {
    // Convert ECG arrays to the format expected by the backend
    let lead1Data: any = data.ecgLead1;
    let lead2Data: any = data.ecgLead2;
    let lead3Data: any = data.ecgLead3;

    // If arrays are provided, send to Flask backend for ML classification
    if (Array.isArray(lead1Data) && Array.isArray(lead2Data) && Array.isArray(lead3Data)) {
      const ecgClassification = await classifyEcg({
        lead1: lead1Data,
        lead2: lead2Data,
        lead3: lead3Data,
      });

      // Use classification results for analysis
      lead1Data = ecgClassification.overall_prediction;
      lead2Data = ecgClassification.overall_prediction;
      lead3Data = ecgClassification.overall_prediction;
    } else {
      // Handle single numeric values
      lead1Data = typeof lead1Data === 'number' ? lead1Data : parseFloat(lead1Data);
      lead2Data = typeof lead2Data === 'number' ? lead2Data : parseFloat(lead2Data);
      lead3Data = typeof lead3Data === 'number' ? lead3Data : parseFloat(lead3Data);
    }

    const validatedData: RiskFactorAnalysisInput = {
        ecgLead1: lead1Data,
        ecgLead2: lead2Data,
        ecgLead3: lead3Data,
        oxygenSaturation: data.oxygenSaturation,
    };
    
    const result = await riskFactorAnalysis(validatedData);

    const { firestore } = initializeFirebase();
    const assessmentsCollection = firestore.collection('patient_assessments');
    
    let riskLevel = 1;
    if (result.heartFailureRisk.level === 'moderate') riskLevel = 2;
    if (result.heartFailureRisk.level === 'high') riskLevel = 3;
    if (result.overallSummary.overallAssessment === 'consult_specialist') riskLevel = 4;

    const { serverTimestamp } = await import('firebase-admin/firestore');

    await assessmentsCollection.add({
      patientName: data.patientName,
      patientId: data.hnId,
      patientAge: data.age,
      patientGender: data.gender,
      submissionTimestamp: serverTimestamp(),
      riskLevel: riskLevel,
      status: 'pending',
      aiAnalysis: result,
      doctorComment: '',
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("Error in getRiskAnalysis action:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return { success: false, error: errorMessage };
  }
}

async function classifyEcg(ecgData: {
  lead1: number[];
  lead2: number[];
  lead3: number[];
}): Promise<any> {
  try {
    const response = await fetch('http://localhost:5000/ecg-model', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ecgData),
    });

    if (!response.ok) {
      throw new Error(`Flask backend error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.warn("ECG classification from Flask failed, proceeding with default values:", error);
    // Return default classification if Flask is not available
    return {
      overall_prediction: 'Normal Beat',
      average_probabilities: {
        'Normal Beat': 1.0,
      },
    };
  }
}

export async function saveDoctorComment(assessmentId: string, comment: string, finalRiskLevel: number) {
    try {
        const { firestore } = initializeFirebase();
        const assessmentRef = firestore.collection('patient_assessments').doc(assessmentId);
        await assessmentRef.update({
            doctorComment: comment,
            status: 'reviewed',
            doctorFinalRiskLevel: finalRiskLevel
        });
        return { success: true };
    } catch (error) {
        console.error("Error saving doctor comment:", error);
        return { success: false, error: "Failed to save comment." };
    }
}
