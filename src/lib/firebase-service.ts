'use client';

import { ref, push, set } from "firebase/database";
import { database } from "@/lib/firebase"; // Assuming you have initialized Firebase in this file

export interface PatientRecord {
    // Patient Info
    patientName: string;
    age?: number | null;
    weight?: number | null;
    height?: number | null;
    symptoms?: string;
    // Calculated Values
    bmi?: number | null;
    riskLevel: number;
    riskScore: number;
    // Sensor Data
    bpm?: number | null;
    oxygenSaturation?: number | null;
    bodyTemp?: number | null;
    ecgLead1?: number | null;
    ecgLead2?: number | null;
    ecgLead3?: number | null;
    ecgAbnormal: boolean;
    murmur: boolean;
    // Timestamp
    timestamp: string;
}

/**
 * Saves a new patient record to the Firebase Realtime Database.
 * @param record The patient data to save.
 * @returns The unique key of the new record.
 */
export async function savePatientRecord(record: PatientRecord): Promise<string> {
    try {
        const recordsRef = ref(database, 'patient-records');
        const newRecordRef = push(recordsRef); // push() generates a new unique key
        await set(newRecordRef, record);
        console.log("Record saved successfully with key:", newRecordRef.key);
        if (!newRecordRef.key) {
            throw new Error("Failed to get new record key from Firebase.");
        }
        return newRecordRef.key;
    } catch (error) {
        console.error("Error saving record to Firebase:", error);
        throw new Error("Failed to save record to Firebase.");
    }
}
