'use client';
import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { setDoc } from 'firebase/firestore';
import { getFirestore, doc } from 'firebase/firestore';


/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  // CRITICAL: Call signInAnonymously directly. Do NOT use 'await signInAnonymously(...)'.
  signInAnonymously(authInstance);
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}

/** Initiate email/password sign-up (non-blocking). */
export async function initiateEmailSignUp(
  authInstance: Auth, 
  email: string, 
  password: string, 
  firstName: string, 
  lastName: string,
  onError: (error: any) => void
): Promise<void> {
  try {
    const userCredential = await createUserWithEmailAndPassword(authInstance, email, password);
    const user = userCredential.user;
    // IMPORTANT: Initialize Firestore with the app from the auth instance to ensure it's connected.
    const db = getFirestore(authInstance.app);

    // Update Firebase Auth Profile
    await updateProfile(user, {
      displayName: `${firstName} ${lastName}`
    });

    // Create HealthcareProfessional document in Firestore
    const professionalRef = doc(db, 'healthcare_professionals', user.uid);
    const professionalData = {
      id: user.uid,
      firstName: firstName,
      lastName: lastName,
      email: user.email,
      specialty: "Cardiology" // A sensible default
    };
    
    // This now correctly writes to the database.
    await setDoc(professionalRef, professionalData);
    
    // The onAuthStateChanged listener will handle the redirect.
    
  } catch (error: any) {
    // Handle sign-up errors (e.g., email already in use)
    console.error("Sign up error:", error);
    if (onError) {
      onError(error);
    } else {
        console.error("An unexpected error occurred during sign-up", error);
    }
  }
}

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(
  authInstance: Auth, 
  email: string, 
  password: string,
  onError: (error: any) => void
): void {
  // CRITICAL: Call signInWithEmailAndPassword directly. Do NOT use 'await signInWithEmailAndPassword(...)'.
  signInWithEmailAndPassword(authInstance, email, password)
   .catch((error: any) => {
      console.error("Sign in error:", error);
      if (onError) {
        onError(error);
      }
   });
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}
