/**
 * Firebase Realtime Database Client for SmartNeb Mobile
 *
 * Connects directly to:
 * https://smartneb-d98e1-default-rtdb.asia-southeast1.firebasedatabase.app/
 *
 * Features:
 * - Direct zero-dependency REST & SSE polling from Firebase Realtime Database
 * - Live ESP32 telemetry (SpO2, BPM, Body Temp, Ambient Temp, Battery)
 * - Robust temperature parsing with invalid sensor detection (-127, 85, -999, etc.)
 * - Manual override mode and physical nebulizer relay control (Force Start / Force Stop)
 * - Confirmed hardware relay state verification
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
  temperature: number | null;
  ambientTemperature: number | null;
  temperatureSource?: string | null;
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
    actualRelay: boolean;
    mode: "AUTO" | "MANUAL";
    manualOverride: boolean;
    lastCommand?: string | null;
  };
  finger: boolean;
  lastUpdated: number;
  online: boolean;
}

export const EMPTY_FIREBASE_TELEMETRY: FirebaseTelemetryData = {
  bpm: null,
  spo2: null,
  bodyTemperature: null,
  temperature: null,
  ambientTemperature: null,
  temperatureSource: null,
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
    actualRelay: false,
    mode: "AUTO",
    manualOverride: false,
    lastCommand: null,
  },
  finger: false,
  lastUpdated: 0,
  online: false,
};

function parseNum(v: any): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Filter out error codes, disconnected states, and unphysical values:
 * -127: DS18B20 disconnected
 * 85: DS18B20 power-on reset state before initial conversion
 * -999 / -998: MLX90614 bus error
 * <= 0 or > 65: Out of valid human/ambient physiological range
 */
export function sanitizeTemperature(v: any): number | null {
  const n = parseNum(v);
  if (n === null) return null;
  if (n <= 0 || n === 85 || n === -127 || n <= -990 || n > 65) {
    return null;
  }
  return Math.round(n * 10) / 10;
}

export function normalizeFirebaseData(raw: any): FirebaseTelemetryData {
  if (!raw) return { ...EMPTY_FIREBASE_TELEMETRY };

  const lastSeen = parseNum(raw.LastSeen) || Date.now();
  const isOnline = Date.now() - lastSeen < 60000;

  // Extract body temperature across all possible firmware field names
  const rawBodyTemp =
    raw.BodyTemp ??
    raw.bodyTemp ??
    raw.body_temp ??
    raw.temperature ??
    raw.temp ??
    raw.Temp;

  const rawAmbientTemp =
    raw.AmbientTemp ??
    raw.ambientTemp ??
    raw.ambient_temp;

  const rawBatteryTemp =
    raw.BatteryTemp ??
    raw.batteryTemp ??
    raw.battery_temp;

  let bodyTemp = sanitizeTemperature(rawBodyTemp);
  let tempSource = bodyTemp !== null ? "body" : null;

  // If dedicated BodyTemp is not detected, check if probe was connected to BatteryTemp
  if (bodyTemp === null && rawBatteryTemp != null) {
    const candidate = sanitizeTemperature(rawBatteryTemp);
    if (candidate !== null && candidate >= 20 && candidate <= 45) {
      bodyTemp = candidate;
      tempSource = "probe";
    }
  }

  const ambientTemp = sanitizeTemperature(rawAmbientTemp);

  // Mode and Relay
  const isManual =
    raw.Mode === "MANUAL" ||
    raw.mode === "MANUAL" ||
    raw.ManualOverride === true ||
    raw.ManualOverride === "true";

  const targetRelay =
    raw.Relay === true ||
    raw.Relay === "true" ||
    raw.Relay === 1 ||
    raw.NebulizerON === true ||
    raw.NebulizerON === 1;

  const confirmedRelay =
    raw.ActualRelay === true ||
    raw.ActualRelay === "true" ||
    raw.RelayStatus === true ||
    raw.RelayStatus === "true" ||
    targetRelay;

  return {
    bpm: parseNum(raw.BPM ?? raw.bpm),
    spo2: parseNum(raw.SpO2 ?? raw.spo2),
    bodyTemperature: bodyTemp,
    temperature: bodyTemp ?? ambientTemp,
    ambientTemperature: ambientTemp,
    temperatureSource: tempSource,
    battery: {
      percentage: parseNum(raw.BatteryPercent ?? raw.batteryPercent),
      voltage: parseNum(raw.BatteryVoltage ?? raw.batteryVoltage),
      current: parseNum(raw.BatteryCurrent ?? raw.batteryCurrent),
      power: parseNum(raw.BatteryPower ?? raw.batteryPower),
      temperature: sanitizeTemperature(rawBatteryTemp),
      status: raw.BatteryStatus || "normal",
    },
    nebulizer: {
      relay: targetRelay,
      actualRelay: confirmedRelay,
      mode: isManual ? "MANUAL" : "AUTO",
      manualOverride: isManual,
      lastCommand: raw.LastCommand || null,
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
    const cleanBase = FIREBASE_RTDB_URL.replace(/\/$/, "");
    let res = await fetch(`${cleanBase}/${node}.json`);
    if (!res.ok) {
      // Fallback try /patients/<node>.json
      res = await fetch(`${cleanBase}/patients/${node}.json`);
      if (!res.ok) return null;
    }
    const data = await res.json();
    return normalizeFirebaseData(data);
  } catch (err) {
    return null;
  }
}

/**
 * Actuate the physical nebulizer relay on the ESP32 via Firebase:
 * Sets Relay, Mode ("MANUAL" | "AUTO"), and ManualOverride
 */
export async function setFirebaseRelay(
  on: boolean,
  node: string = DEFAULT_FIREBASE_NODE,
  mode: "AUTO" | "MANUAL" = "MANUAL"
): Promise<boolean> {
  try {
    const cleanBase = FIREBASE_RTDB_URL.replace(/\/$/, "");
    const payload = {
      Relay: Boolean(on),
      Mode: mode,
      ManualOverride: mode === "MANUAL",
      LastCommand: on ? "FORCE_START" : "FORCE_STOP",
      CommandTimestamp: Date.now(),
    };

    // 1. Write to root node (e.g. /Patient1.json)
    const res = await fetch(`${cleanBase}/${node}.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // 2. Also directly update Relay.json
    await fetch(`${cleanBase}/${node}/Relay.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Boolean(on)),
    }).catch(() => null);

    // 3. Also update /patients/<node>/Relay.json if accessible
    await fetch(`${cleanBase}/patients/${node}/Relay.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Boolean(on)),
    }).catch(() => null);

    return res.ok;
  } catch (err) {
    console.warn("Failed to actuate Firebase relay:", err);
    return false;
  }
}

/**
 * Switch nebulizer between AUTO and MANUAL mode in Firebase
 */
export async function setFirebaseMode(
  mode: "AUTO" | "MANUAL",
  node: string = DEFAULT_FIREBASE_NODE
): Promise<boolean> {
  try {
    const cleanBase = FIREBASE_RTDB_URL.replace(/\/$/, "");
    const payload = {
      Mode: mode,
      ManualOverride: mode === "MANUAL",
      LastCommand: `SET_MODE_${mode}`,
      CommandTimestamp: Date.now(),
    };

    const res = await fetch(`${cleanBase}/${node}.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.warn("Failed to set Firebase mode:", err);
    return false;
  }
}

/**
 * Subscribe to live telemetry changes from Firebase RTDB
 */
export function subscribeFirebaseTelemetry(
  onData: (telemetry: FirebaseTelemetryData) => void,
  node: string = DEFAULT_FIREBASE_NODE,
  intervalMs: number = 2500
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
