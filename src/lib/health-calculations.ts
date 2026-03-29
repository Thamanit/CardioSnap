'use client';

// Define the structure for the data used in risk calculation
export interface HealthDataForRisk {
  bpm?: number | null;
  bodyTemp?: number | null;
  ecgAbnormal: boolean;
  murmur: boolean;
  oxygenSaturation?: number | null;
}

// Define the structure for risk level definitions
export const RISK_LEVELS: { [key: number]: { label: string; color: string; twClass: string } } = {
  4: { label: "Critical", color: "#ef4444", twClass: "bg-red-500 text-white" },
  3: { label: "High", color: "#f97316", twClass: "bg-orange-500 text-white" },
  2: { label: "Moderate", color: "#facc15", twClass: "bg-yellow-400 text-gray-800" },
  1: { label: "Low", color: "#22c55e", twClass: "bg-green-500 text-white" },
};

/**
 * Calculates Body Mass Index (BMI).
 * @param weightKg Weight in kilograms.
 * @param heightCm Height in centimeters.
 * @returns BMI value or null if inputs are invalid.
 */
export function calculateBmi(weightKg: number, heightCm: number): number | null {
  if (weightKg > 0 && heightCm > 0) {
    const heightM = heightCm / 100;
    return weightKg / (heightM * heightM);
  }
  return null;
}

/**
 * Calculates the cardiovascular risk score based on specific health metrics.
 * @param data The health data for calculation.
 * @returns An object containing the raw score and the corresponding risk level.
 */
export function calculateRiskScore(data: HealthDataForRisk): { score: number; level: number } {
  let score = 0;

  // Rule 1: BPM
  if (data.bpm && (data.bpm > 120 || data.bpm < 50)) {
    score += 2;
  }

  // Rule 2: ECG Abnormal
  if (data.ecgAbnormal) {
    score += 2;
  }

  // Rule 3: Heart Murmur
  if (data.murmur) {
    score += 2;
  }

  // Rule 4: Body Temperature
  if (data.bodyTemp && data.bodyTemp > 38) {
    score += 1;
  }

  // Rule 5: Oxygen Saturation
  if (data.oxygenSaturation && data.oxygenSaturation < 94) {
    score += 1;
  }

  // Convert score to level
  let level = 1; // Default to Low risk
  if (score >= 5) {
    level = 4; // Critical
  } else if (score >= 3) {
    level = 3; // High
  } else if (score >= 1) {
    level = 2; // Moderate
  }

  return { score, level };
}
