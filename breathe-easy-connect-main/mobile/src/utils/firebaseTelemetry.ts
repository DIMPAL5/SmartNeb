/**
 * Firebase Realtime Database Client for SmartNeb Mobile
 *
 * Connects directly to:
 * https://smartneb-d98e1-default-rtdb.asia-southeast1.firebasedatabase.app/
 *
 * Features:
 * - Direct zero-dependency REST & SSE polling from Firebase Realtime Database
 * - Live ESP32 telemetry (SpO2, BPM, Body Temp, Ambient Temp, Battery)
 * - Physical nebulizer relay control: PUT /<node>/Relay.json -> true | false
 * - Works natively in Android, iOS, Hermes engine, and Expo Go without native build modules
 */

export const FIREBASE_RTDB_URL =
  process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ||
  "https://smartneb-d98e1-default-rtdb.asia-southeast1.firebasedatabase.app";

export const DEFAULT_FIREBASE_NODE = "Patient1";

export interface FirebaseTelemetryData {
  bpm: number | null;
  spo2: number | null;
  bodyTemperature: number | null;
  ambientTemperature: number | null;
  battery: {
    percentage: number | null;
    voltage: number | null;
    current: number | null;
    power: number | null;
    temperature: number | null;
    status: string;
  };
  nebulizer: {
    relay: boolean;
  };
  finger: boolean;
  lastUpdated: number;
  online: boolean;
}

export const EMPTY_FIREBASE_TELEMETRY: FirebaseTelemetryData = {
  bpm: null,
  spo2: null,
  bodyTemperature: null,
  ambientTemperature: null,
  battery: {
    percentage: null,
    voltage: null,
    current: null,
    power: null,
    temperature: null,
    status: "normal",
  },
  nebulizer: {
    relay: false,
  },
  finger: false,
  lastUpdated: 0,
  online: false,
};

function parseNum(v: any): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

export function normalizeFirebaseData(raw: any): FirebaseTelemetryData {
  if (!raw) return { ...EMPTY_FIREBASE_TELEMETRY };

  const lastSeen = parseNum(raw.LastSeen) || Date.now();
  const isOnline = Date.now() - lastSeen < 60000;

  return {
    bpm: parseNum(raw.BPM),
    spo2: parseNum(raw.SpO2),
    bodyTemperature: parseNum(raw.BodyTemp),
    ambientTemperature: parseNum(raw.AmbientTemp),
    battery: {
      percentage: parseNum(raw.BatteryPercent),
      voltage: parseNum(raw.BatteryVoltage),
      current: parseNum(raw.BatteryCurrent),
      power: parseNum(raw.BatteryPower),
      temperature: parseNum(raw.BatteryTemp),
      status: raw.BatteryStatus || "normal",
    },
    nebulizer: {
      relay: raw.Relay === true || raw.Relay === "true" || raw.Relay === 1,
    },
    finger: raw.Finger === true || raw.Finger === "true",
    lastUpdated: lastSeen,
    online: isOnline,
  };
}

/**
 * Fetch latest telemetry snapshot from Firebase RTDB
 */
export async function fetchFirebaseTelemetry(
  node: string = DEFAULT_FIREBASE_NODE
): Promise<FirebaseTelemetryData | null> {
  try {
    const url = `${FIREBASE_RTDB_URL.replace(/\/$/, "")}/${node}.json`;
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return normalizeFirebaseData(data);
  } catch (err) {
    return null;
  }
}

/**
 * Actuate the physical nebulizer relay on the ESP32 via Firebase:
 * PUT /<node>/Relay.json -> true | false
 */
export async function setFirebaseRelay(
  on: boolean,
  node: string = DEFAULT_FIREBASE_NODE
): Promise<boolean> {
  try {
    const url = `${FIREBASE_RTDB_URL.replace(/\/$/, "")}/${node}/Relay.json`;
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Boolean(on)),
    });
    return res.ok;
  } catch (err) {
    console.warn("Failed to actuate Firebase relay:", err);
    return false;
  }
}

/**
 * Subscribe to live telemetry changes from Firebase RTDB
 */
export function subscribeFirebaseTelemetry(
  onData: (telemetry: FirebaseTelemetryData) => void,
  node: string = DEFAULT_FIREBASE_NODE,
  intervalMs: number = 3000
): () => void {
  let isSubscribed = true;

  const poll = async () => {
    if (!isSubscribed) return;
    const data = await fetchFirebaseTelemetry(node);
    if (data && isSubscribed) {
      onData(data);
    }
  };

  poll();
  const timer = setInterval(poll, intervalMs);

  return () => {
    isSubscribed = false;
    clearInterval(timer);
  };
}
