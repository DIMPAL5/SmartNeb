import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CaregiverPatientRow = {
  id: string;
  full_name: string;
  mrn: string;
  condition: string | null;
  relation: string | null;
  spo2_threshold: number;
  bpm_low_threshold: number;
  bpm_high_threshold: number;
  temp_threshold: number;
  deviceCode: string | null;
  deviceStatus: string | null;
  lastSeenAt: string | null;
  mqttConnected: boolean | null;
  fluidLevel: number | null;
  bpm: number | null;
  spo2: number | null;
  bodyTemperature: number | null;
  recordedAt: string | null;
  activeAlerts: number;
  criticalAlerts: number;
  activeSOS: number;
  sessionStatus: string | null;
  planMedication: string | null;
};

export const listMyCarePatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CaregiverPatientRow[]> => {
    const { supabase, userId } = context;

    const { data: caregiver } = await supabase
      .from("caregivers")
      .select("id, relation")
      .eq("user_id", userId)
      .maybeSingle();
    if (!caregiver) return [];

    const { data: assignments } = await supabase
      .from("caregiver_patient_assignments")
      .select("patient_id")
      .eq("caregiver_id", caregiver.id);

    const ids = (assignments ?? []).map((a) => a.patient_id);
    if (!ids.length) return [];

    const [patients, devices, health, alerts, sessions, plans, sos] = await Promise.all([
      supabase.from("patients").select("*").in("id", ids).is("deleted_at", null),
      supabase.from("devices").select("*").in("patient_id", ids),
      supabase
        .from("health_telemetry")
        .select("patient_id, bpm, spo2, body_temperature, recorded_at")
        .in("patient_id", ids)
        .order("recorded_at", { ascending: false })
        .limit(600),
      supabase.from("alerts").select("patient_id, severity").in("patient_id", ids).eq("status", "active"),
      supabase
        .from("nebulization_sessions")
        .select("patient_id, status, started_at")
        .in("patient_id", ids)
        .in("status", ["pending", "starting", "running", "paused"]),
      supabase
        .from("care_plans")
        .select("patient_id, medication, start_date")
        .in("patient_id", ids)
        .eq("status", "published")
        .order("start_date", { ascending: false }),
      supabase.from("sos_events").select("patient_id, status").in("patient_id", ids).neq("status", "resolved"),
    ]);

    type HealthRow = NonNullable<typeof health.data>[number];
    const latest = new Map<string, HealthRow>();
    for (const row of health.data ?? []) {
      if (!latest.has(row.patient_id)) latest.set(row.patient_id, row);
    }
    const deviceBy = new Map((devices.data ?? []).map((d) => [d.patient_id as string, d]));
    const sessionBy = new Map((sessions.data ?? []).map((s) => [s.patient_id, s]));
    const planBy = new Map<string, string>();
    for (const p of plans.data ?? []) {
      if (!planBy.has(p.patient_id)) planBy.set(p.patient_id, p.medication);
    }

    return (patients.data ?? []).map((p) => {
      const h = latest.get(p.id);
      const d = deviceBy.get(p.id);
      const pAlerts = (alerts.data ?? []).filter((a) => a.patient_id === p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        mrn: p.mrn,
        condition: p.condition,
        relation: caregiver.relation ?? null,
        spo2_threshold: Number(p.spo2_threshold),
        bpm_low_threshold: Number(p.bpm_low_threshold),
        bpm_high_threshold: Number(p.bpm_high_threshold),
        temp_threshold: Number(p.temp_threshold),
        deviceCode: d?.device_code ?? null,
        deviceStatus: d?.status ?? null,
        lastSeenAt: d?.last_seen_at ?? null,
        mqttConnected: d?.mqtt_connected ?? null,
        fluidLevel: d?.fluid_level == null ? null : Number(d.fluid_level),
        bpm: h?.bpm == null ? null : Number(h.bpm),
        spo2: h?.spo2 == null ? null : Number(h.spo2),
        bodyTemperature: h?.body_temperature == null ? null : Number(h.body_temperature),
        recordedAt: h?.recorded_at ?? null,
        activeAlerts: pAlerts.length,
        criticalAlerts: pAlerts.filter((a) => a.severity === "critical").length,
        activeSOS: (sos.data ?? []).filter((s) => s.patient_id === p.id).length,
        sessionStatus: sessionBy.get(p.id)?.status ?? null,
        planMedication: planBy.get(p.id) ?? null,
      };
    });
  });
