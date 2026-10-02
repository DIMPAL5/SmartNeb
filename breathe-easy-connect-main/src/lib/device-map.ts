/**
 * Patient ⇄ Firebase device-node mapping.
 *
 * The ESP32 firmware publishes under a root node such as `/Patient1`. Nothing
 * in the UI should hard-code that path: components resolve the node through
 * this layer so additional devices (Patient2, Patient3, …) can be added by
 * configuration only.
 *
 * Mapping sources, in order of precedence:
 *  1. VITE_FIREBASE_DEVICE_MAP — JSON: { "<supabase patient id or MRN>": "Patient2" }
 *  2. A device code that already looks like a Firebase node (e.g. "Patient1")
 *  3. VITE_FIREBASE_DEFAULT_NODE (defaults to "Patient1")
 */

const DEFAULT_NODE = (import.meta.env["VITE_FIREBASE_DEFAULT_NODE"] as string) || "Patient1";

function parsedMap(): Record<string, string> {
  const raw = import.meta.env["VITE_FIREBASE_DEVICE_MAP"] as string | undefined;
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function resolveDeviceNode(opts: {
  patientId?: string | null;
  mrn?: string | null;
  deviceCode?: string | null;
}): string {
  const map = parsedMap();
  if (opts.patientId && map[opts.patientId]) return map[opts.patientId]!;
  if (opts.mrn && map[opts.mrn]) return map[opts.mrn]!;
  if (opts.deviceCode && map[opts.deviceCode]) return map[opts.deviceCode]!;
  if (opts.deviceCode && /^Patient\d+$/i.test(opts.deviceCode)) return opts.deviceCode;
  return DEFAULT_NODE;
}
