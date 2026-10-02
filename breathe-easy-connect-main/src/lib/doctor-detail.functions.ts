import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertDoctorAssigned, doctorPatientIds, resolveDoctorId } from "./doctor-access";

export type DoctorAlertRow = {
  id: string;
  patient_id: string;
  patientName: string;
  mrn: string;
  type: string;
  severity: string;
  status: string;
  message: string;
  value: number | null;
  threshold: number | null;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
};

export type DoctorCarePlanRow = {
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
  doctor_id: string | null;
  mine: boolean;
  created_at: string;
};

export type DoctorNoteRow = {
  id: string;
  patient_id: string;
  patientName: string;
  mrn: string;
  note: string;
  created_at: string;
  doctorName: string | null;
  mine: boolean;
};

export type DoctorReportRow = {
  id: string;
  patient_id: string;
  patientName: string;
  mrn: string;
  kind: string;
  format: string;
  range_start: string | null;
  range_end: string | null;
  created_at: string;
  mine: boolean;
  payload: any;
  summary: {
    samples: number | null;
    avgSpo2: number | null;
    minSpo2: number | null;
    avgBpm: number | null;
    avgTemp: number | null;
    alerts: number | null;
    sessions: number | null;
  };
};

export type DoctorPatientDetail = {
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
  device: {
    device_code: string;
    status: string;
    firmware: string;
    mqtt_connected: boolean;
    cloud_connected: boolean;
    fluid_level: number;
    nebulizer_state: string;
    last_seen_at: string | null;
  } | null;
  battery: { percentage: number | null; charging: boolean; recorded_at: string } | null;
  activeSession: { id: string; status: string; started_at: string } | null;
  caregivers: { full_name: string; relation: string }[];
};

const patientArg = z.object({ patientId: z.string().uuid() });

export const getDoctorPatientDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId: string }) => patientArg.parse(d))
  .handler(async ({ data, context }): Promise<DoctorPatientDetail> => {
    const { supabase, userId } = context;
    await assertDoctorAssigned(supabase, userId, data.patientId);
    const id = data.patientId;

    const [patient, device, battery, session, caregiverLinks] = await Promise.all([
      supabase.from("patients").select("*").eq("id", id).maybeSingle(),
      supabase.from("devices").select("*").eq("patient_id", id).maybeSingle(),
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
        .from("caregiver_patient_assignments")
        .select("caregivers(full_name, relation)")
        .eq("patient_id", id),
    ]);

    if (!patient.data) throw new Error("Patient not found.");
    const p = patient.data;

    let contact: { email: string | null; phone: string | null } | null = null;
    if (p.user_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("email, phone")
        .eq("id", p.user_id)
        .maybeSingle();
      if (prof) contact = { email: prof.email ?? null, phone: prof.phone ?? null };
    }

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
      device: d
        ? {
            device_code: d.device_code,
            status: d.status,
            firmware: d.firmware,
            mqtt_connected: d.mqtt_connected,
            cloud_connected: d.cloud_connected,
            fluid_level: Number(d.fluid_level),
            nebulizer_state: d.nebulizer_state,
            last_seen_at: d.last_seen_at,
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
      caregivers: (caregiverLinks.data ?? [])
        .map((r: any) => r.caregivers)
        .filter(Boolean)
        .map((c: any) => ({ full_name: c.full_name, relation: c.relation })),
    };
  });

export const listDoctorAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { includeResolved?: boolean; patientId?: string }) =>
    z
      .object({ includeResolved: z.boolean().optional(), patientId: z.string().uuid().optional() })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<DoctorAlertRow[]> => {
    const { supabase, userId } = context;
    const all = await doctorPatientIds(supabase, userId);
    const ids = data.patientId ? all.filter((i) => i === data.patientId) : all;
    if (!ids.length) return [];

    let query = supabase
      .from("alerts")
      .select("*")
      .in("patient_id", ids)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!data.includeResolved) query = query.neq("status", "resolved");

    const [alerts, patients] = await Promise.all([
      query,
      supabase.from("patients").select("id, full_name, mrn").in("id", ids),
    ]);
    const by = new Map((patients.data ?? []).map((p: any) => [p.id, p]));

    return (alerts.data ?? []).map((a: any) => ({
      id: a.id,
      patient_id: a.patient_id,
      patientName: (by.get(a.patient_id) as any)?.full_name ?? "Patient",
      mrn: (by.get(a.patient_id) as any)?.mrn ?? "",
      type: a.type,
      severity: a.severity,
      status: a.status,
      message: a.message,
      value: a.value == null ? null : Number(a.value),
      threshold: a.threshold == null ? null : Number(a.threshold),
      created_at: a.created_at,
      acknowledged_at: a.acknowledged_at,
      resolved_at: a.resolved_at,
    }));
  });

export const listDoctorCarePlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DoctorCarePlanRow[]> => {
    const { supabase, userId } = context;
    const ids = await doctorPatientIds(supabase, userId);
    if (!ids.length) return [];
    const doctorId = await resolveDoctorId(supabase, userId);

    const [plans, patients] = await Promise.all([
      supabase
        .from("care_plans")
        .select("*")
        .in("patient_id", ids)
        .order("created_at", { ascending: false })
        .limit(200),
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
      doctor_id: row.doctor_id,
      mine: Boolean(doctorId) && row.doctor_id === doctorId,
      created_at: row.created_at,
    }));
  });

export const listDoctorNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { patientId?: string }) =>
    z.object({ patientId: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<DoctorNoteRow[]> => {
    const { supabase, userId } = context;
    const all = await doctorPatientIds(supabase, userId);
    const ids = data.patientId ? all.filter((i) => i === data.patientId) : all;
    if (!ids.length) return [];
    const doctorId = await resolveDoctorId(supabase, userId);

    const [notes, patients, doctors] = await Promise.all([
      supabase
        .from("clinical_notes")
        .select("*")
        .in("patient_id", ids)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("patients").select("id, full_name, mrn").in("id", ids),
      supabase.from("doctors").select("id, full_name"),
    ]);
    const by = new Map((patients.data ?? []).map((p: any) => [p.id, p]));
    const docBy = new Map((doctors.data ?? []).map((d: any) => [d.id, d.full_name]));

    return (notes.data ?? []).map((n: any) => ({
      id: n.id,
      patient_id: n.patient_id,
      patientName: (by.get(n.patient_id) as any)?.full_name ?? "Patient",
      mrn: (by.get(n.patient_id) as any)?.mrn ?? "",
      note: n.note,
      created_at: n.created_at,
      doctorName: docBy.get(n.doctor_id) ?? null,
      mine: Boolean(doctorId) && n.doctor_id === doctorId,
    }));
  });

export const listDoctorReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { patientId?: string }) =>
    z.object({ patientId: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<DoctorReportRow[]> => {
    const { supabase, userId } = context;
    const all = await doctorPatientIds(supabase, userId);
    const ids = data.patientId ? all.filter((i) => i === data.patientId) : all;
    if (!ids.length) return [];

    const [reports, patients] = await Promise.all([
      supabase
        .from("reports")
        .select("*")
        .in("patient_id", ids)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("patients").select("id, full_name, mrn").in("id", ids),
    ]);
    const by = new Map((patients.data ?? []).map((p: any) => [p.id, p]));

    return (reports.data ?? []).map((r: any) => {
      const payload = (r.payload ?? {}) as any;
      return {
        id: r.id,
        patient_id: r.patient_id,
        patientName: (by.get(r.patient_id) as any)?.full_name ?? "Patient",
        mrn: (by.get(r.patient_id) as any)?.mrn ?? "",
        kind: r.kind,
        format: r.format,
        range_start: r.range_start,
        range_end: r.range_end,
        created_at: r.created_at,
        mine: r.requested_by === userId,
        payload,
        summary: {
          samples: payload?.vitals?.samples ?? null,
          avgSpo2: payload?.vitals?.avgSpo2 ?? null,
          minSpo2: payload?.vitals?.minSpo2 ?? null,
          avgBpm: payload?.vitals?.avgBpm ?? null,
          avgTemp: payload?.vitals?.avgTemp ?? null,
          alerts: Array.isArray(payload?.alerts) ? payload.alerts.length : null,
          sessions: Array.isArray(payload?.sessions) ? payload.sessions.length : null,
        },
      };
    });
  });

const editSchema = z.object({
  planId: z.string().uuid(),
  medication: z.string().min(2).max(120),
  dosage: z.string().min(1).max(80),
  durationMinutes: z.number().int().min(1).max(120),
  frequencyPerDay: z.number().int().min(1).max(12),
  instructions: z.string().max(1000).optional().nullable(),
  startDate: z.string().min(8),
  endDate: z.string().min(8).optional().nullable(),
  timeSlots: z
    .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/))
    .max(12)
    .optional(),
});

export type CarePlanEditInput = z.infer<typeof editSchema>;

export const updateCarePlanDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: CarePlanEditInput) => editSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("care_plans")
      .update({
        medication: data.medication,
        dosage: data.dosage,
        duration_minutes: data.durationMinutes,
        frequency_per_day: data.frequencyPerDay,
        instructions: data.instructions ?? null,
        start_date: data.startDate,
        end_date: data.endDate ?? null,
        ...(data.timeSlots ? { time_slots: data.timeSlots } : {}),
      })
      .eq("id", data.planId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "care_plan.update",
      target_type: "care_plan",
      target_id: data.planId,
    });
    return { ok: true };
  });
