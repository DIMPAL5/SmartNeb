/**
 * SmartNeb server-side alert & threshold engine.
 *
 * Runs without any browser attached (pg_cron -> /api/public/cron/evaluate-alerts)
 * so patients are monitored even when nobody is signed in. It extends the
 * existing `alerts` + `notifications` + `audit_logs` tables — it is deliberately
 * NOT a second alert system.
 */

export type Severity = "critical" | "warning" | "info";

export type EvaluatedAlert = {
  patientId: string;
  deviceId: string | null;
  type: string;
  severity: Severity;
  value: number | null;
  threshold: number | null;
  message: string;
};

export type EngineResult = {
  patientsEvaluated: number;
  alertsCreated: number;
  notificationsCreated: number;
  suppressedDuplicates: number;
  details: { patientId: string; type: string; severity: Severity }[];
};

/** How long an alert of the same type stays suppressed after being raised. */
const DEDUPE_WINDOW_MS = 30 * 60_000;

type PatientRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  spo2_threshold: number | string;
  bpm_low_threshold: number | string;
  bpm_high_threshold: number | string;
  temp_threshold: number | string;
  battery_low_threshold: number | string;
  offline_after_minutes: number;
  alerts_enabled: boolean;
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Pure rule evaluation — unit-testable, no I/O. */
export function evaluatePatient(input: {
  patient: PatientRow;
  device: { id: string; status: string; last_seen_at: string | null } | null;
  health: { bpm: unknown; spo2: unknown; body_temperature: unknown; recorded_at: string } | null;
  battery: { percentage: unknown; recorded_at: string } | null;
  /** False when the device registry could not be read; avoids false "no device" alerts. */
  deviceRegistryKnown?: boolean;
  now: number;
}): EvaluatedAlert[] {
  const { patient: p, device, health, battery, now } = input;
  const deviceRegistryKnown = input.deviceRegistryKnown !== false;
  if (p.alerts_enabled === false) return [];

  const out: EvaluatedAlert[] = [];
  const deviceId = device?.id ?? null;
  const base = { patientId: p.id, deviceId };

  const spo2Min = Number(p.spo2_threshold);
  const bpmLow = Number(p.bpm_low_threshold);
  const bpmHigh = Number(p.bpm_high_threshold);
  const tempMax = Number(p.temp_threshold);
  const batteryMin = Number(p.battery_low_threshold);

  // Only evaluate vitals that are reasonably fresh (<= 30 min old).
  const fresh = health && now - new Date(health.recorded_at).getTime() <= 30 * 60_000;

  if (fresh && health) {
    const spo2 = num(health.spo2);
    if (spo2 !== null) {
      if (spo2 < spo2Min - 4) {
        out.push({
          ...base,
          type: "spo2_critical",
          severity: "critical",
          value: spo2,
          threshold: spo2Min,
          message: `Critical desaturation: SpO₂ ${spo2}% is far below the ${spo2Min}% threshold.`,
        });
      } else if (spo2 < spo2Min) {
        out.push({
          ...base,
          type: "spo2_low",
          severity: "warning",
          value: spo2,
          threshold: spo2Min,
          message: `SpO₂ ${spo2}% is below the ${spo2Min}% threshold.`,
        });
      }
    }

    const bpm = num(health.bpm);
    if (bpm !== null) {
      if (bpm > bpmHigh + 20) {
        out.push({
          ...base,
          type: "bpm_critical",
          severity: "critical",
          value: bpm,
          threshold: bpmHigh,
          message: `Severe tachycardia: heart rate ${bpm} bpm (limit ${bpmHigh}).`,
        });
      } else if (bpm > bpmHigh) {
        out.push({
          ...base,
          type: "bpm_high",
          severity: "warning",
          value: bpm,
          threshold: bpmHigh,
          message: `Heart rate ${bpm} bpm is above the ${bpmHigh} bpm limit.`,
        });
      } else if (bpm < bpmLow) {
        out.push({
          ...base,
          type: "bpm_low",
          severity: bpm < bpmLow - 10 ? "critical" : "warning",
          value: bpm,
          threshold: bpmLow,
          message: `Bradycardia: heart rate ${bpm} bpm is below the ${bpmLow} bpm floor.`,
        });
      }
    }

    const temp = num(health.body_temperature);
    if (temp !== null) {
      if (temp >= tempMax + 1) {
        out.push({
          ...base,
          type: "temp_critical",
          severity: "critical",
          value: temp,
          threshold: tempMax,
          message: `High fever: body temperature ${temp}°C (limit ${tempMax}°C).`,
        });
      } else if (temp >= tempMax) {
        out.push({
          ...base,
          type: "temp_high",
          severity: "warning",
          value: temp,
          threshold: tempMax,
          message: `Body temperature ${temp}°C reached the ${tempMax}°C threshold.`,
        });
      }
    }
  }

  const pct = battery ? num(battery.percentage) : null;
  if (pct !== null) {
    if (pct <= Math.max(5, batteryMin / 2)) {
      out.push({
        ...base,
        type: "battery_critical",
        severity: "critical",
        value: pct,
        threshold: batteryMin,
        message: `Device battery critically low at ${pct}% — therapy may be interrupted.`,
      });
    } else if (pct <= batteryMin) {
      out.push({
        ...base,
        type: "battery_low",
        severity: "warning",
        value: pct,
        threshold: batteryMin,
        message: `Device battery low at ${pct}% (alert below ${batteryMin}%).`,
      });
    }
  }

  if (device) {
    const lastSeen = device.last_seen_at ? new Date(device.last_seen_at).getTime() : null;
    const minutes = lastSeen === null ? null : Math.round((now - lastSeen) / 60_000);
    const limit = p.offline_after_minutes || 20;
    if (device.status === "disabled") {
      // Intentionally disabled devices do not raise offline alerts.
    } else if (minutes === null || minutes > limit) {
      out.push({
        ...base,
        type: "device_offline",
        severity: minutes !== null && minutes > limit * 6 ? "critical" : "warning",
        value: minutes,
        threshold: limit,
        message:
          minutes === null
            ? `Device ${"has never reported"} — no telemetry received yet.`
            : `Device offline: no telemetry for ${minutes} minutes (limit ${limit}).`,
      });
    }
  } else if (deviceRegistryKnown) {
    out.push({
      ...base,
      type: "device_missing",
      severity: "info",
      value: null,
      threshold: null,
      message: "No monitoring device is registered for this patient.",
    });
  }

  return out;
}

/** Resolves patient user + assigned doctors + caregivers + staff-free recipients. */
async function recipientsFor(admin: any, patientId: string): Promise<string[]> {
  const [patient, docs, cares] = await Promise.all([
    admin.from("patients").select("user_id").eq("id", patientId).maybeSingle(),
    admin
      .from("doctor_patient_assignments")
      .select("doctor_id, doctors(user_id)")
      .eq("patient_id", patientId),
    admin
      .from("caregiver_patient_assignments")
      .select("caregiver_id, caregivers(user_id)")
      .eq("patient_id", patientId),
  ]);

  const ids = new Set<string>();
  if (patient.data?.user_id) ids.add(patient.data.user_id);
  for (const d of docs.data ?? []) if (d.doctors?.user_id) ids.add(d.doctors.user_id);
  for (const c of cares.data ?? []) if (c.caregivers?.user_id) ids.add(c.caregivers.user_id);
  return [...ids];
}

/**
 * Evaluates every active patient and persists new alerts + notifications.
 * `admin` is the service-role Supabase client (server-only).
 */
export async function runAlertEngine(admin: any, patientIds?: string[]): Promise<EngineResult> {
  const now = Date.now();
  let query = admin
    .from("patients")
    .select(
      "id, user_id, full_name, spo2_threshold, bpm_low_threshold, bpm_high_threshold, temp_threshold, battery_low_threshold, offline_after_minutes, alerts_enabled",
    )
    .is("deleted_at", null);
  if (patientIds?.length) query = query.in("id", patientIds);

  const [{ data: patients }, deviceQuery] = await Promise.all([
    query,
    admin.from("devices").select("id, patient_id, status, last_seen_at"),
  ]);
  const devices = deviceQuery.data;
  // A failed registry read must not look like "patient has no device".
  const deviceRegistryKnown = !deviceQuery.error && Array.isArray(devices);

  const rows: PatientRow[] = patients ?? [];
  const deviceBy = new Map<string, any>();
  for (const d of devices ?? []) if (d.patient_id) deviceBy.set(d.patient_id, d);

  const result: EngineResult = {
    patientsEvaluated: rows.length,
    alertsCreated: 0,
    notificationsCreated: 0,
    suppressedDuplicates: 0,
    details: [],
  };

  for (const patient of rows) {
    const [health, battery, recent] = await Promise.all([
      admin
        .from("health_telemetry")
        .select("bpm, spo2, body_temperature, recorded_at")
        .eq("patient_id", patient.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("battery_telemetry")
        .select("percentage, recorded_at")
        .eq("patient_id", patient.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("alerts")
        .select("id, type, status, created_at")
        .eq("patient_id", patient.id)
        .gte("created_at", new Date(now - DEDUPE_WINDOW_MS).toISOString()),
    ]);

    const candidates = evaluatePatient({
      patient,
      device: deviceBy.get(patient.id) ?? null,
      deviceRegistryKnown,
      health: health.data ?? null,
      battery: battery.data ?? null,
      now,
    });
    if (!candidates.length) continue;

    const openTypes = new Set(
      (recent.data ?? [])
        .filter((a: any) => a.status !== "resolved" || true)
        .map((a: any) => a.type as string),
    );
    // Also suppress while an alert of that type is still unresolved, even if older.
    const { data: stillOpen } = await admin
      .from("alerts")
      .select("type")
      .eq("patient_id", patient.id)
      .neq("status", "resolved");
    for (const a of stillOpen ?? []) openTypes.add(a.type as string);

    const fresh = candidates.filter((c) => {
      if (openTypes.has(c.type)) {
        result.suppressedDuplicates += 1;
        return false;
      }
      return true;
    });
    if (!fresh.length) continue;

    const { data: inserted, error } = await admin
      .from("alerts")
      .insert(
        fresh.map((c) => ({
          patient_id: c.patientId,
          device_id: c.deviceId,
          type: c.type,
          severity: c.severity,
          value: c.value,
          threshold: c.threshold,
          message: c.message,
          status: "active",
        })),
      )
      .select("id, type, severity, message");
    if (error) continue;

    result.alertsCreated += inserted?.length ?? 0;
    for (const c of fresh) {
      result.details.push({ patientId: c.patientId, type: c.type, severity: c.severity });
    }

    // Notify: patient + assigned care team only. Warnings and criticals only.
    const notify = (inserted ?? []).filter((a: any) => a.severity !== "info");
    if (notify.length) {
      const users = await recipientsFor(admin, patient.id);
      if (users.length) {
        const payload = users.flatMap((uid) =>
          notify.map((a: any) => ({
            user_id: uid,
            patient_id: patient.id,
            type: a.severity === "critical" ? "alert_critical" : "alert_warning",
            title:
              a.severity === "critical"
                ? `Critical alert — ${patient.full_name}`
                : `Alert — ${patient.full_name}`,
            body: a.message,
          })),
        );
        const { error: nErr } = await admin.from("notifications").insert(payload);
        if (!nErr) result.notificationsCreated += payload.length;
      }
    }

    await admin.from("audit_logs").insert(
      (inserted ?? []).map((a: any) => ({
        actor_id: null,
        actor_name: "SmartNeb alert engine",
        action: "alert.create",
        target_type: "alert",
        target_id: a.id,
        meta: { patient_id: patient.id, type: a.type, severity: a.severity },
      })),
    );
  }

  return result;
}
