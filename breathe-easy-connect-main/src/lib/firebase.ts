/**
 * Firebase Realtime Database bootstrap (browser only).
 *
 * Holds ESP32 IoT telemetry + relay control ONLY. All application/business
 * data (auth, roles, patients, care plans, reports…) stays in Supabase.
 * Configuration comes from VITE_FIREBASE_* environment variables.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

const DEFAULT_DATABASE_URL = "https://smartneb-d98e1-default-rtdb.asia-southeast1.firebasedatabase.app";

const config = {
  apiKey: (import.meta.env["VITE_FIREBASE_API_KEY"] as string | undefined) || "AIzaSyDummyKeyForSmartNebFirebaseRTDB2026",
  authDomain: (import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"] as string | undefined) || "smartneb-d98e1.firebaseapp.com",
  databaseURL: (import.meta.env["VITE_FIREBASE_DATABASE_URL"] as string | undefined) || DEFAULT_DATABASE_URL,
  projectId: (import.meta.env["VITE_FIREBASE_PROJECT_ID"] as string | undefined) || "smartneb-d98e1",
  storageBucket: (import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"] as string | undefined) || "smartneb-d98e1.appspot.com",
  messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] as string | undefined,
  appId: import.meta.env["VITE_FIREBASE_APP_ID"] as string | undefined,
};

export const isFirebaseConfigured = Boolean(config.databaseURL);

let app: FirebaseApp | null = null;
let db: Database | null = null;

/** Lazily returns the Realtime Database handle, or null when unconfigured/SSR. */
export function getRealtimeDb(): Database | null {
  if (typeof window === "undefined" || !isFirebaseConfigured) return null;
  if (db) return db;
  try {
    app = getApps().length ? getApp() : initializeApp({ ...config } as Record<string, string>);
    db = getDatabase(app, config.databaseURL);
    return db;
  } catch (err) {
    console.warn("Failed to initialize Firebase Realtime Database:", err);
    return null;
  }
}
