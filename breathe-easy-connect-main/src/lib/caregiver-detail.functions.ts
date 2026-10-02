import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAssigned, assignedPatientIds } from "./caregiver-access";

export type CaregiverNoteRow = {
  id: string;
  patient_id: string;
  note: string;
  created_at: string;
  authorName: string | null;
  patientName: string | null;
  mine: boolean;
};

export type CareAlertRow = {
  id: string;
  patient_id: string;
  patientName: string;
  mrn: string;
  type: string;
  severity: string;
  status: string;
  message: string;
  created_at: string;
};

export type CarePlanRow = {
  id: string;
  patient_id: string;
  patientName: string;
  mrn: string;
  medication: string;
  dosage: string;
  duration_minutes: number;
  frequency_per_day: number;
  instructions: string | null;
  start_date: string;
  end_date: string | null;
  time_slots: string[];
  status: string;
  doctorName: string | null;
};

export type CarePatientDetail = {
  patient: {
    id: string;
    full_name: string;
    mrn: string;
    condition: string | null;
    date_of_birth: string | null;
    sex: string | null;
    spo2_threshold: number;
    bpm_low_threshold: number;
    bpm_high_threshold: number;
    temp_threshold: number;
  };
  contact: { email: string | null; phone: string | null } | null;
  relation: string | null;
  device: {
    device_code: string;
    status: string;
    firmware: string;
    mqtt_connected: boolean;
    cloud_connected: boolean;
    fluid_level: number;
    last_seen_at: string | null;
  } | null;
  health: {
    bpm: number | null;
    spo2: number | null;
    body_temperature: number | null;
    recorded_at: string;
  } | null;
  battery: { percentage: number | null; charging: boolean; recorded_at: string } | null;
  activeSession: { id: string; status: string; started_at: string } | null;
  carePlans: CarePlanRow[];
  doctors: { full_name: string; specialty: string }[];
};

export const getCarePatientDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId: string }) => z.object({ patientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<CarePatientDetail> => {
    const { supabase, userId } = context;
    const { relation } = await assertAssigned(supabase, userId, data.patientId);
    const id = data.patientId;

    const [patient, device, health, battery, session, plans, docLinks] = await Promise.all([
      supabase.from("patients").select("*").eq("id", id).maybeSingle(),
      supabase.from("devices").select("*").eq("patient_id", id).maybeSingle(),
      supabase
        .from("health_telemetry")
        .select("bpm, spo2, body_temperature, recorded_at")
        .eq("patient_id", id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("battery_telemetry")
        .select("percentage, charging, recorded_at")
        .eq("patient_id", id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("nebulization_sessions")
        .select("id, status, started_at")
        .eq("patient_id", id)
        .in("status", ["pending", "starting", "running", "paused"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("care_plans")
        .select("*, doctors(full_name)")
        .eq("patient_id", id)
        .order("start_date", { ascending: false })
        .limit(20),
      supabase
        .from("doctor_patient_assignments")
        .select("doctors(full_name, specialty)")
        .eq("patient_id", id),
    ]);

    if (!patient.data) throw new Error("Patient not found.");

    let contact: { email: string | null; phone: string | null } | null = null;
    if (patient.data.user_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("email, phone")
        .eq("id", patient.data.user_id)
        .maybeSingle();
      if (prof) contact = { email: prof.email ?? null, phone: prof.phone ?? null };
    }

    const p = patient.data;
    const d = device.data;

    return {
      patient: {
        id: p.id,
        full_name: p.full_name,
        mrn: p.mrn,
        condition: p.condition,
        date_of_birth: p.date_of_birth,
        sex: p.sex,
        spo2_threshold: Number(p.spo2_threshold),
        bpm_low_threshold: Number(p.bpm_low_threshold),
        bpm_high_threshold: Number(p.bpm_high_threshold),
        temp_threshold: Number(p.temp_threshold),
      },
      contact,
      relation,
      device: d
        ? {
            device_code: d.device_code,
            status: d.status,
            firmware: d.firmware,
            mqtt_connected: d.mqtt_connected,
            cloud_connected: d.cloud_connected,
            fluid_level: Number(d.fluid_level),
            last_seen_at: d.last_seen_at,
          }
        : null,
      health: health.data
        ? {
            bpm: health.data.bpm == null ? null : Number(health.data.bpm),
            spo2: health.data.spo2 == null ? null : Number(health.data.spo2),
            body_temperature:
              health.data.body_temperature == null ? null : Number(health.data.body_temperature),
            recorded_at: health.data.recorded_at,
          }
        : null,
      battery: battery.data
        ? {
            percentage: battery.data.percentage == null ? null : Number(battery.data.percentage),
            charging: battery.data.charging,
            recorded_at: battery.data.recorded_at,
          }
        : null,
      activeSession: session.data ?? null,
      carePlans: (plans.data ?? []).map((row: any) => ({
        id: row.id,
        patient_id: row.patient_id,
        patientName: p.full_name,
        mrn: p.mrn,
        medication: row.medication,
        dosage: row.dosage,
        duration_minutes: row.duration_minutes,
        frequency_per_day: row.frequency_per_day,
        instructions: row.instructions,
        start_date: row.start_date,
        end_date: row.end_date,
        time_slots: Array.isArray(row.time_slots) ? (row.time_slots as string[]) : [],
        status: row.status,
        doctorName: row.doctors?.full_name ?? null,
      })),
      doctors: (docLinks.data ?? [])
        .map((r: any) => r.doctors)
        .filter(Boolean)
        .map((doc: any) => ({ full_name: doc.full_name, specialty: doc.specialty })),
    };
  });

export const listCareAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { includeResolved?: boolean }) =>
    z.object({ includeResolved: z.boolean().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<CareAlertRow[]> => {
    const { supabase, userId } = context;
    const ids = await assignedPatientIds(supabase, userId);
    if (!ids.length) return [];

    let query = supabase
      .from("alerts")
      .select("*")
      .in("patient_id", ids)
      .order("created_at", { ascending: false })
      .limit(150);
    if (!data.includeResolved) query = query.neq("status", "resolved");

    const [alerts, patients] = await Promise.all([
      query,
      supabase.from("patients").select("id, full_name, mrn").in("id", ids),
    ]);
    const nameBy = new Map((patients.data ?? []).map((p: any) => [p.id, p]));

    return (alerts.data ?? []).map((a: any) => ({
      id: a.id,
      patient_id: a.patient_id,
      patientName: (nameBy.get(a.patient_id) as any)?.full_name ?? "Patient",
      mrn: (nameBy.get(a.patient_id) as any)?.mrn ?? "",
      type: a.type,
      severity: a.severity,
      status: a.status,
      message: a.message,
      created_at: a.created_at,
    }));
  });

export const listCareCarePlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CarePlanRow[]> => {
    const { supabase, userId } = context;
    const ids = await assignedPatientIds(supabase, userId);
    if (!ids.length) return [];

    const [plans, patients] = await Promise.all([
      supabase
        .from("care_plans")
        .select("*, doctors(full_name)")
        .in("patient_id", ids)
        .order("start_date", { ascending: false })
        .limit(100),
      supabase.from("patients").select("id, full_name, mrn").in("id", ids),
    ]);
    const by = new Map((patients.data ?? []).map((p: any) => [p.id, p]));

    return (plans.data ?? []).map((row: any) => ({
      id: row.id,
      patient_id: row.patient_id,
      patientName: (by.get(row.patient_id) as any)?.full_name ?? "Patient",
      mrn: (by.get(row.patient_id) as any)?.mrn ?? "",
      medication: row.medication,
      dosage: row.dosage,
      duration_minutes: row.duration_minutes,
      frequency_per_day: row.frequency_per_day,
      instructions: row.instructions,
      start_date: row.start_date,
      end_date: row.end_date,
      time_slots: Array.isArray(row.time_slots) ? (row.time_slots as string[]) : [],
      status: row.status,
      doctorName: row.doctors?.full_name ?? null,
    }));
  });

export const listCaregiverNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { patientId?: string }) =>
    z.object({ patientId: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<CaregiverNoteRow[]> => {
    const { supabase, userId } = context;
    const ids = await assignedPatientIds(supabase, userId);
    const scope = data.patientId ? ids.filter((i) => i === data.patientId) : ids;
    if (!scope.length) return [];

    const [notes, patients, profile] = await Promise.all([
      supabase
        .from("caregiver_notes")
        .select("*")
        .in("patient_id", scope)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("patients").select("id, full_name").in("id", scope),
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    ]);
    const nameBy = new Map((patients.data ?? []).map((p: any) => [p.id, p.full_name]));

    return (notes.data ?? []).map((n: any) => ({
      id: n.id,
      patient_id: n.patient_id,
      note: n.note,
      created_at: n.created_at,
      authorName: n.author_id === userId ? (profile.data?.full_name ?? "You") : "Care team",
      patientName: nameBy.get(n.patient_id) ?? null,
      mine: n.author_id === userId,
    }));
  });

export const addCaregiverNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId: string; note: string }) =>
    z.object({ patientId: z.string().uuid(), note: z.string().min(2).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { caregiverId } = await assertAssigned(supabase, userId, data.patientId);
    const { error } = await supabase.from("caregiver_notes").insert({
      patient_id: data.patientId,
      caregiver_id: caregiverId,
      author_id: userId,
      note: data.note.trim(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
