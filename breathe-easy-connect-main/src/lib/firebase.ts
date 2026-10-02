/**
 * Firebase Realtime Database bootstrap (browser only).
 *
 * Holds ESP32 IoT telemetry + relay control ONLY. All application/business
 * data (auth, roles, patients, care plans, reports…) stays in Supabase.
 * Configuration comes from VITE_FIREBASE_* environment variables.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

const config = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"] as string | undefined,
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"] as string | undefined,
  databaseURL: import.meta.env["VITE_FIREBASE_DATABASE_URL"] as string | undefined,
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"] as string | undefined,
  storageBucket: import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"] as string | undefined,
  messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] as string | undefined,
  appId: import.meta.env["VITE_FIREBASE_APP_ID"] as string | undefined,
};

export const isFirebaseConfigured = Boolean(config.databaseURL && config.apiKey);

let app: FirebaseApp | null = null;
let db: Database | null = null;

/** Lazily returns the Realtime Database handle, or null when unconfigured/SSR. */
export function getRealtimeDb(): Database | null {
  if (typeof window === "undefined" || !isFirebaseConfigured) return null;
  if (db) return db;
  app = getApps().length ? getApp() : initializeApp({ ...config } as Record<string, string>);
  db = getDatabase(app, config.databaseURL);
  return db;
}
