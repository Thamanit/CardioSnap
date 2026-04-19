
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
  ecgLead1: z.coerce.number(),
  ecgLead2: z.coerce.number(),
  ecgLead3: z.coerce.number(),
  oxygenSaturation: z.coerce.number(),
});


export async function getRiskAnalysis(
  data: z.infer<typeof FormSchema>
): Promise<{ success: boolean; data?: RiskFactorAnalysisOutput; error?: string }> {
  try {
    const validatedData: RiskFactorAnalysisInput = {
        ecgLead1: data.ecgLead1,
        ecgLead2: data.ecgLead2,
        ecgLead3: data.ecgLead3,
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
