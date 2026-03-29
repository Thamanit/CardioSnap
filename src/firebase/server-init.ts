
// IMPORTANT: This file is only intended to be used by server-side code.
// It is not intended to be used by client-side code.
//
// If you are looking for a way to initialize Firebase on the client-side,
// please use `src/firebase/index.ts` instead.
import { initializeApp, getApps, getApp, FirebaseApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore'

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  const serviceAccount = getServiceAccount();

  if (!getApps().length) {
    const firebaseApp = initializeApp({
      credential: cert(serviceAccount)
    });

    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

function getServiceAccount() {
  const serviceAccount = process.env.FIREBASE_ADMIN_SDK_CONFIG;
  if (!serviceAccount) {
    throw new Error('Missing environment variable "FIREBASE_ADMIN_SDK_CONFIG"');
  }
  return JSON.parse(serviceAccount);
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';

