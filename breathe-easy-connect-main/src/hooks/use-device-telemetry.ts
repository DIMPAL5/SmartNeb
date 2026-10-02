import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveDeviceNode } from "@/lib/device-map";
import {
  EMPTY_TELEMETRY,
  isFirebaseConfigured,
  OFFLINE_AFTER_MS,
  setRelay,
  subscribeFirebaseConnection,
  subscribeTelemetry,
  type DeviceTelemetry,
} from "@/services/firebaseTelemetry";

export type LivePoint = {
  t: string;
  bpm: number | null;
  spo2: number | null;
  temp: number | null;
};

export type DeviceTelemetryState = {
  node: string;
  telemetry: DeviceTelemetry;
  /** true until the first snapshot (or error) arrives. */
  loading: boolean;
  error: string | null;
  firebaseConnected: boolean;
  /** Real-time points accumulated in this browser session (not history). */
  live: LivePoint[];
  configured: boolean;
  setRelay: (on: boolean) => Promise<void>;
};

const MAX_LIVE_POINTS = 240;

function sameReading(a: DeviceTelemetry, b: Omit<DeviceTelemetry, "online">) {
  return (
    a.bpm === b.bpm &&
    a.spo2 === b.spo2 &&
    a.bodyTemperature === b.bodyTemperature &&
    a.ambientTemperature === b.ambientTemperature &&
    a.battery.voltage === b.battery.voltage &&
    a.battery.percentage === b.battery.percentage &&
    a.battery.current === b.battery.current &&
    a.battery.power === b.battery.power &&
    a.battery.temperature === b.battery.temperature &&
    a.nebulizer.relay === b.nebulizer.relay
  );
}

/**
 * Live ESP32 telemetry for one patient, read from Firebase Realtime Database.
 * Online-ness is derived from telemetry freshness, never assumed.
 */
export function useDeviceTelemetry(opts: {
  patientId?: string | null;
  mrn?: string | null;
  deviceCode?: string | null;
}): DeviceTelemetryState {
  const node = resolveDeviceNode(opts);
  const [telemetry, setTelemetry] = useState<DeviceTelemetry>(EMPTY_TELEMETRY);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const [live, setLive] = useState<LivePoint[]>([]);
  const [, forceTick] = useState(0);
  const lastRef = useRef<DeviceTelemetry>(EMPTY_TELEMETRY);

  useEffect(() => {
    setTelemetry(EMPTY_TELEMETRY);
    lastRef.current = EMPTY_TELEMETRY;
    setLive([]);
    setLoading(isFirebaseConfigured);
    setError(null);

    const stopConn = subscribeFirebaseConnection(setFirebaseConnected);
    const stop = subscribeTelemetry(node, (e) => {
      setLoading(false);
      if (e.kind === "error") {
        setError(e.message);
        return;
      }
      setError(null);
      const prev = lastRef.current;
      const changed = !sameReading(prev, e.telemetry);
      const next: DeviceTelemetry = {
        ...e.telemetry,
        // Keep the previous change timestamp when nothing actually changed so
        // a stale device eventually flips to offline.
        lastUpdated: changed ? e.telemetry.lastUpdated : (prev.lastUpdated ?? e.telemetry.lastUpdated),
        online: true,
      };
      lastRef.current = next;
      setTelemetry(next);
      if (changed && (next.bpm != null || next.spo2 != null || next.bodyTemperature != null)) {
        setLive((pts) =>
          [
            ...pts,
            {
              t: new Date().toISOString(),
              bpm: next.bpm,
              spo2: next.spo2,
              temp: next.bodyTemperature,
            },
          ].slice(-MAX_LIVE_POINTS),
        );
      }
    });

    return () => {
      stop();
      stopConn();
    };
  }, [node]);

  // Re-evaluate freshness on a ticker so "Offline" appears without new data.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const online =
    telemetry.lastUpdated != null && Date.now() - telemetry.lastUpdated < OFFLINE_AFTER_MS;

  const relay = useCallback((on: boolean) => setRelay(node, on), [node]);

  return useMemo(
    () => ({
      node,
      telemetry: { ...telemetry, online },
      loading,
      error,
      firebaseConnected,
      live,
      configured: isFirebaseConfigured,
      setRelay: relay,
    }),
    [node, telemetry, online, loading, error, firebaseConnected, live, relay],
  );
}
