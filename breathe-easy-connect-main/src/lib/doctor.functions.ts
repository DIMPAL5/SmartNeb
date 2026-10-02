import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const patientInput = z.object({ patientId: z.string().uuid() });

export type DoctorPatientRow = {
  id: string;
  full_name: string;
  mrn: string;
  condition: string | null;
  sex: string | null;
  date_of_birth: string | null;
  spo2_threshold: number;
  bpm_low_threshold: number;
  bpm_high_threshold: number;
  temp_threshold: number;
  deviceStatus: string | null;
  deviceCode: string | null;
  lastSeenAt: string | null;
  bpm: number | null;
  spo2: number | null;
  bodyTemperature: number | null;
  recordedAt: string | null;
  activeAlerts: number;
  criticalAlerts: number;
  sessionStatus: string | null;
  planMedication: string | null;
};

async function resolveDoctorId(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("doctors")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Roster                                                              */
/* ------------------------------------------------------------------ */

export const listMyPatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DoctorPatientRow[]> => {
    const { supabase, userId } = context;
    const doctorId = await resolveDoctorId(supabase as never, userId);
    if (!doctorId) return [];

    const { data: assignments } = await supabase
      .from("doctor_patient_assignments")
      .select("patient_id")
      .eq("doctor_id", doctorId);

    const ids = (assignments ?? []).map((a) => a.patient_id);
    if (!ids.length) return [];

    const [patients, devices, health, alerts, sessions, plans] = await Promise.all([
      supabase.from("patients").select("*").in("id", ids).is("deleted_at", null),
      supabase.from("devices").select("*").in("patient_id", ids),
      supabase
        .from("health_telemetry")
        .select("patient_id, bpm, spo2, body_temperature, recorded_at")
        .in("patient_id", ids)
        .order("recorded_at", { ascending: false })
        .limit(600),
      supabase
        .from("alerts")
        .select("patient_id, severity")
        .in("patient_id", ids)
        .eq("status", "active"),
      supabase
        .from("nebulization_sessions")
        .select("patient_id, status, started_at")
        .in("patient_id", ids)
        .in("status", ["pending", "starting", "running", "paused"]),
      supabase
        .from("care_plans")
        .select("patient_id, medication, status, start_date")
        .in("patient_id", ids)
        .eq("status", "published")
        .order("start_date", { ascending: false }),
    ]);

    type HealthRow = NonNullable<typeof health.data>[number];
    const latest = new Map<string, HealthRow>();
    for (const row of health.data ?? []) {
      if (!latest.has(row.patient_id)) latest.set(row.patient_id, row);
    }
    const deviceBy = new Map((devices.data ?? []).map((d) => [d.patient_id as string, d]));
    const sessionBy = new Map((sessions.data ?? []).map((s) => [s.patient_id, s]));
    const planBy = new Map<string, { medication: string }>();
    for (const p of plans.data ?? []) {
      if (!planBy.has(p.patient_id)) planBy.set(p.patient_id, { medication: p.medication });
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
        sex: p.sex,
        date_of_birth: p.date_of_birth,
        spo2_threshold: Number(p.spo2_threshold),
        bpm_low_threshold: Number(p.bpm_low_threshold),
        bpm_high_threshold: Number(p.bpm_high_threshold),
        temp_threshold: Number(p.temp_threshold),
        deviceStatus: d?.status ?? null,
        deviceCode: d?.device_code ?? null,
        lastSeenAt: d?.last_seen_at ?? null,
        bpm: h?.bpm == null ? null : Number(h.bpm),
        spo2: h?.spo2 == null ? null : Number(h.spo2),
        bodyTemperature: h?.body_temperature == null ? null : Number(h.body_temperature),
        recordedAt: h?.recorded_at ?? null,
        activeAlerts: pAlerts.length,
        criticalAlerts: pAlerts.filter((a) => a.severity === "critical").length,
        sessionStatus: sessionBy.get(p.id)?.status ?? null,
        planMedication: planBy.get(p.id)?.medication ?? null,
      };
    });
  });

/* ------------------------------------------------------------------ */
/* Care plans                                                          */
/* ------------------------------------------------------------------ */

export const listCarePlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId: string }) => patientInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("care_plans")
      .select("*")
      .eq("patient_id", data.patientId)
      .order("created_at", { ascending: false })
      .limit(30);
    return rows ?? [];
  });

const carePlanSchema = z.object({
  patientId: z.string().uuid(),
  medication: z.string().min(2).max(120),
  dosage: z.string().min(1).max(80),
  durationMinutes: z.number().int().min(1).max(120),
  frequencyPerDay: z.number().int().min(1).max(12),
  instructions: z.string().max(1000).optional(),
  startDate: z.string().min(8),
  endDate: z.string().min(8).optional().nullable(),
  timeSlots: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).max(12).optional(),
  publish: z.boolean().optional(),
});

export type CarePlanInput = z.infer<typeof carePlanSchema>;

export const createCarePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: CarePlanInput) => carePlanSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const doctorId = await resolveDoctorId(supabase as never, userId);
    if (!doctorId) throw new Error("No clinician record is linked to this account.");

    const status = data.publish === false ? "draft" : "published";

    const { data: plan, error } = await supabase
      .from("care_plans")
      .insert({
        patient_id: data.patientId,
        doctor_id: doctorId,
        medication: data.medication,
        dosage: data.dosage,
        duration_minutes: data.durationMinutes,
        frequency_per_day: data.frequencyPerDay,
        instructions: data.instructions ?? null,
        start_date: data.startDate,
        end_date: data.endDate ?? null,
        time_slots: data.timeSlots ?? [],
        status,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { data: patient } = await supabase
      .from("patients")
      .select("user_id, full_name")
      .eq("id", data.patientId)
      .maybeSingle();

    if (status === "published") {
      const { insertNotifications, careTeamUserIds } = await import("./notify.server");
      const team = await careTeamUserIds(data.patientId, [userId]);
      const summary = `${data.medication} ${data.dosage} · ${data.durationMinutes} min, ${data.frequencyPerDay}x daily${
        data.timeSlots?.length ? ` at ${data.timeSlots.join(", ")}` : ""
      }`;
      await insertNotifications(
        team.all.map((id) => ({
          user_id: id,
          patient_id: data.patientId,
          type: "care_plan",
          title:
            id === team.patientUserId
              ? "New therapy plan published"
              : `New therapy plan for ${patient?.full_name ?? "a patient"}`,
          body: summary,
        })),
      );
    }

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "care_plan.create",
      target_type: "care_plan",
      target_id: plan.id,
      meta: { patient_id: data.patientId, status },
    });

    return plan;
  });

export const setCarePlanStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string; status: "draft" | "published" | "paused" | "ended" }) =>
    z
      .object({
        planId: z.string().uuid(),
        status: z.enum(["draft", "published", "paused", "ended"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("care_plans")
      .update({ status: data.status })
      .eq("id", data.planId);
    if (error) throw new Error(error.message);

    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: "care_plan.status",
      target_type: "care_plan",
      target_id: data.planId,
      meta: { status: data.status },
    });
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Clinical notes                                                      */
/* ------------------------------------------------------------------ */

export const listClinicalNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId: string }) => patientInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("clinical_notes")
      .select("*")
      .eq("patient_id", data.patientId)
      .order("created_at", { ascending: false })
      .limit(30);
    return rows ?? [];
  });

export const addClinicalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId: string; note: string }) =>
    patientInput.extend({ note: z.string().min(2).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const doctorId = await resolveDoctorId(supabase as never, userId);
    if (!doctorId) throw new Error("No clinician record is linked to this account.");

    const { data: note, error } = await supabase
      .from("clinical_notes")
      .insert({ patient_id: data.patientId, doctor_id: doctorId, note: data.note })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return note;
  });
