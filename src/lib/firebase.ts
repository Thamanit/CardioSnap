import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAhvSFarMjbcza5H2tPB-c24muPrr82S1U",
  authDomain: "cardiocapfirebasestud.firebaseapp.com",
  databaseURL:
    "https://cardiocapfirebasestud-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "cardiocapfirebasestud",
  storageBucket: "cardiocapfirebasestud.firebasestorage.app",
  messagingSenderId: "155686134366",
  appId: "1:155686134366:web:9aeddeb853548f7b3d8acf"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const database = getDatabase(app);
export const auth = getAuth(app);