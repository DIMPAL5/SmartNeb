import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Shared types                                                        */
/* ------------------------------------------------------------------ */

export type AppRole = "patient" | "doctor" | "caregiver" | "admin" | "super_admin";

export type MeContext = {
  userId: string;
  email: string | null;
  fullName: string;
  role: AppRole;
  patientId: string | null;
  doctorId: string | null;
  caregiverId: string | null;
  isActive: boolean;
};

/* ------------------------------------------------------------------ */
/* Identity                                                           */
/* ------------------------------------------------------------------ */

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MeContext> => {
    const { supabase, userId } = context;
    const [profile, roles, patient, doctor, caregiver] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("patients").select("id").eq("user_id", userId).maybeSingle(),
      supabase.from("doctors").select("id").eq("user_id", userId).maybeSingle(),
      supabase.from("caregivers").select("id").eq("user_id", userId).maybeSingle(),
    ]);

    const roleList = (roles.data ?? []).map((r) => r.role as AppRole);
    const priority: AppRole[] = ["super_admin", "admin", "doctor", "caregiver", "patient"];
    const role = priority.find((r) => roleList.includes(r)) ?? "patient";

    return {
      userId,
      email: profile.data?.email ?? null,
      fullName: profile.data?.full_name ?? "Clinician",
      role,
      patientId: patient.data?.id ?? null,
      doctorId: doctor.data?.id ?? null,
      caregiverId: caregiver.data?.id ?? null,
      isActive: profile.data?.is_active !== false,
    };
  });

/* ------------------------------------------------------------------ */
/* Patient snapshot                                                   */
/* ------------------------------------------------------------------ */

const patientInput = z.object({ patientId: z.string().uuid() });

export const getPatientSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId: string }) => patientInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const pid = data.patientId;

    const [patient, device, health, env, battery, plan, alerts, activeSession] = await Promise.all([
      supabase.from("patients").select("*").eq("id", pid).maybeSingle(),
      supabase.from("devices").select("*").eq("patient_id", pid).maybeSingle(),
      supabase
        .from("health_telemetry")
        .select("*")
        .eq("patient_id", pid)
        .order("recorded_at", { ascending: false })
        .limit(2),
      supabase
        .from("environmental_telemetry")
        .select("*")
        .eq("patient_id", pid)
        .order("recorded_at", { ascending: false })
        .limit(1),
      supabase
        .from("battery_telemetry")
        .select("*")
        .eq("patient_id", pid)
        .order("recorded_at", { ascending: false })
        .limit(2),
      supabase
        .from("care_plans")
        .select("*")
        .eq("patient_id", pid)
        .eq("status", "published")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("alerts")
        .select("*")
        .eq("patient_id", pid)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("nebulization_sessions")
        .select("*")
        .eq("patient_id", pid)
        .in("status", ["pending", "starting", "running", "paused"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      patient: patient.data,
      device: device.data,
      health: health.data?.[0] ?? null,
      healthPrev: health.data?.[1] ?? null,
      environment: env.data?.[0] ?? null,
      battery: battery.data?.[0] ?? null,
      batteryPrev: battery.data?.[1] ?? null,
      carePlan: plan.data,
      activeAlerts: alerts.data ?? [],
      activeSession: activeSession.data,
      serverTime: new Date().toISOString(),
    };
  });

/* ------------------------------------------------------------------ */
/* Telemetry series                                                   */
/* ------------------------------------------------------------------ */

const seriesInput = z.object({
  patientId: z.string().uuid(),
  minutes: z
    .number()
    .int()
    .min(5)
    .max(60 * 24 * 30),
});

export const getTelemetrySeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId: string; minutes: number }) => seriesInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.minutes * 60_000).toISOString();

    const [health, env, battery] = await Promise.all([
      supabase
        .from("health_telemetry")
        .select("recorded_at, bpm, spo2, body_temperature")
        .eq("patient_id", data.patientId)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: true })
        .limit(1500),
      supabase
        .from("environmental_telemetry")
        .select("recorded_at, ambient_temperature, humidity, aqi")
        .eq("patient_id", data.patientId)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: true })
        .limit(1500),
      supabase
        .from("battery_telemetry")
        .select("recorded_at, percentage, voltage, current, cell_temperature")
        .eq("patient_id", data.patientId)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: true })
        .limit(1500),
    ]);

    return {
      health: health.data ?? [],
      environment: env.data ?? [],
      battery: battery.data ?? [],
    };
  });

/* ------------------------------------------------------------------ */
/* Nebulization sessions + device command flow                        */
/* ------------------------------------------------------------------ */

export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId: string; limit?: number }) =>
    patientInput.extend({ limit: z.number().int().min(1).max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("nebulization_sessions")
      .select("*")
      .eq("patient_id", data.patientId)
      .order("started_at", { ascending: false })
      .limit(data.limit ?? 50);
    return rows ?? [];
  });

export const startSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId: string }) => patientInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: owns } = await supabase.rpc("owns_patient", { _patient_id: data.patientId });
    if (!owns) throw new Error("Only the patient can control their own nebulizer.");

    const { data: device } = await supabase
      .from("devices")
      .select("*")
      .eq("patient_id", data.patientId)
      .maybeSingle();
    const { data: plan } = await supabase
      .from("care_plans")
      .select("*")
      .eq("patient_id", data.patientId)
      .eq("status", "published")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const prescribed = (plan?.duration_minutes ?? 10) * 60;

    const { data: session, error } = await supabase
      .from("nebulization_sessions")
      .insert({
        patient_id: data.patientId,
        device_id: device?.id ?? null,
        care_plan_id: plan?.id ?? null,
        medication: plan?.medication ?? null,
        dosage: plan?.dosage ?? null,
        prescribed_seconds: prescribed,
        status: "starting",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("device_commands").insert({
      device_id: device?.id ?? null,
      patient_id: data.patientId,
      session_id: session.id,
      command: "NEB_START",
      state: device?.mqtt_connected ? "sent" : "failed",
      issued_by: userId,
    });

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "session.start",
      target_type: "nebulization_session",
      target_id: session.id,
    });

    return {
      session,
      deviceReachable: Boolean(device?.mqtt_connected),
      simulated: !device?.mqtt_connected,
      deviceCode: device?.device_code ?? null,
    };
  });

const sessionUpdate = z.object({
  sessionId: z.string().uuid(),
  action: z.enum(["ack", "heartbeat", "pause", "resume", "stop", "complete"]),
  elapsedSeconds: z
    .number()
    .int()
    .min(0)
    .max(60 * 60 * 4),
});

export const updateSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof sessionUpdate>) => sessionUpdate.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: session } = await supabase
      .from("nebulization_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session) throw new Error("Session not found");

    const statusMap = {
      ack: "running",
      heartbeat: "running",
      pause: "paused",
      resume: "running",
      stop: "stopped",
      complete: "completed",
    } as const;
    const status = statusMap[data.action];
    const finished = data.action === "stop" || data.action === "complete";

    const { data: updated, error } = await supabase
      .from("nebulization_sessions")
      .update({
        status,
        elapsed_seconds: data.elapsedSeconds,
        ended_at: finished ? new Date().toISOString() : null,
      })
      .eq("id", data.sessionId)
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (data.action !== "ack" && data.action !== "heartbeat") {
      await supabase.from("device_commands").insert({
        device_id: session.device_id,
        patient_id: session.patient_id,
        session_id: session.id,
        command: `NEB_${data.action.toUpperCase()}`,
        state: "sent",
        issued_by: userId,
      });
    }

    if (finished) {
      const ratio = session.prescribed_seconds
        ? Math.min(1, data.elapsedSeconds / session.prescribed_seconds)
        : 0;
      await supabase.from("adherence_records").insert({
        patient_id: session.patient_id,
        care_plan_id: session.care_plan_id,
        session_id: session.id,
        scheduled_for: new Date().toISOString().slice(0, 10),
        status: data.action === "complete" ? "completed" : ratio >= 0.5 ? "partial" : "missed",
        completion_ratio: Number(ratio.toFixed(2)),
      });
      const { insertNotifications, careTeamUserIds } = await import("./notify.server");
      const team = await careTeamUserIds(session.patient_id);
      const detail = `${session.medication ?? "Therapy"} · ${Math.round(data.elapsedSeconds / 60)} min recorded`;
      await insertNotifications(
        team.all.map((id) => ({
          user_id: id,
          patient_id: session.patient_id,
          type: data.action === "complete" ? "session_completed" : "session_stopped",
          title:
            data.action === "complete" ? "Nebulization session completed" : "Session ended early",
          body: detail,
        })),
      );
      await supabase.from("audit_logs").insert({
        actor_id: userId,
        action: `session.${data.action}`,
        target_type: "nebulization_session",
        target_id: session.id,
      });
    }

    return updated;
  });

/* ------------------------------------------------------------------ */
/* Adherence                                                          */
/* ------------------------------------------------------------------ */

export const getAdherence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId: string; days?: number }) =>
    patientInput.extend({ days: z.number().int().min(7).max(180).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const days = data.days ?? 30;
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    const { data: rows } = await context.supabase
      .from("adherence_records")
      .select("*")
      .eq("patient_id", data.patientId)
      .gte("scheduled_for", since)
      .order("scheduled_for", { ascending: false });

    const records = rows ?? [];
    const completed = records.filter((r) => r.status === "completed").length;
    const partial = records.filter((r) => r.status === "partial").length;
    const missed = records.filter((r) => r.status === "missed").length;
    const total = records.length;
    const score = total ? Math.round(((completed + partial * 0.5) / total) * 100) : 0;

    return { records, completed, partial, missed, total, score, days };
  });

/* ------------------------------------------------------------------ */
/* Alerts, SOS, refills                                               */
/* ------------------------------------------------------------------ */

export const listAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId: string }) => patientInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("alerts")
      .select("*")
      .eq("patient_id", data.patientId)
      .order("created_at", { ascending: false })
      .limit(100);
    return rows ?? [];
  });

export const acknowledgeAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { alertId: string; resolve?: boolean }) =>
    z.object({ alertId: z.string().uuid(), resolve: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    const patch = data.resolve
      ? { status: "resolved" as const, resolved_at: now, resolved_by: userId }
      : { status: "acknowledged" as const, acknowledged_at: now, acknowledged_by: userId };
    const { error } = await supabase.from("alerts").update(patch).eq("id", data.alertId);
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: data.resolve ? "alert.resolve" : "alert.acknowledge",
      target_type: "alert",
      target_id: data.alertId,
    });
    return { ok: true };
  });

export const raiseAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      patientId: string;
      type: string;
      severity: "critical" | "warning" | "info";
      value?: number;
      threshold?: number;
      message: string;
    }) =>
      z
        .object({
          patientId: z.string().uuid(),
          type: z.string().min(1).max(40),
          severity: z.enum(["critical", "warning", "info"]),
          value: z.number().optional(),
          threshold: z.number().optional(),
          message: z.string().min(1).max(300),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: existing } = await supabase
      .from("alerts")
      .select("id")
      .eq("patient_id", data.patientId)
      .eq("type", data.type)
      .eq("status", "active")
      .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString())
      .maybeSingle();
    if (existing) return { created: false, id: existing.id };

    const { data: row, error } = await supabase
      .from("alerts")
      .insert({
        patient_id: data.patientId,
        type: data.type,
        severity: data.severity,
        value: data.value ?? null,
        threshold: data.threshold ?? null,
        message: data.message,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { created: true, id: row.id };
  });

export const triggerSOS = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId: string; source?: string }) =>
    patientInput.extend({ source: z.enum(["manual", "voice", "api"]).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: owns } = await supabase.rpc("owns_patient", { _patient_id: data.patientId });
    if (!owns) throw new Error("Only the patient can trigger their own SOS.");

    // Recipient discovery and notification creation must not depend on the
    // patient's RLS visibility into staff records. Ownership is verified
    // above, then the trusted server client resolves the actual assignments.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: vitals, error: vitalsError } = await supabaseAdmin
      .from("health_telemetry")
      .select("bpm, spo2, body_temperature, recorded_at")
      .eq("patient_id", data.patientId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (vitalsError) throw new Error(vitalsError.message);

    const { data: sos, error } = await supabaseAdmin
      .from("sos_events")
      .insert({ patient_id: data.patientId, source: data.source ?? "manual", vitals })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const [docsResult, caresResult, patientResult, deviceResult] = await Promise.all([
      supabaseAdmin
        .from("doctor_patient_assignments")
        .select("doctors(user_id)")
        .eq("patient_id", data.patientId),
      supabaseAdmin
        .from("caregiver_patient_assignments")
        .select("caregivers(user_id)")
        .eq("patient_id", data.patientId),
      supabaseAdmin.from("patients").select("full_name").eq("id", data.patientId).single(),
      supabaseAdmin
        .from("devices")
        .select("device_code, status")
        .eq("patient_id", data.patientId)
        .order("last_seen_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const assignmentError = docsResult.error ?? caresResult.error;
    if (assignmentError) throw new Error(assignmentError.message);

    const recipients = [
      ...(docsResult.data ?? []).map(
        (d) => (d.doctors as { user_id: string | null } | null)?.user_id,
      ),
      ...(caresResult.data ?? []).map(
        (c) => (c.caregivers as { user_id: string | null } | null)?.user_id,
      ),
    ].filter(
      (value, index, all): value is string => Boolean(value) && all.indexOf(value) === index,
    );

    if (recipients.length) {
      const device = deviceResult.data;
      const { error: notificationError } = await supabaseAdmin.from("notifications").insert(
        recipients.map((uid) => ({
          user_id: uid,
          patient_id: data.patientId,
          type: "sos",
          title: `Emergency SOS: ${patientResult.data?.full_name ?? "Patient"}`,
          body: `SpO2 ${vitals?.spo2 ?? "--"}% · HR ${vitals?.bpm ?? "--"} bpm · Device ${device?.device_code ?? "unassigned"} (${device?.status ?? "unknown"})`,
        })),
      );
      if (notificationError) throw new Error(notificationError.message);
    }

    const { error: auditError } = await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "sos.trigger",
      target_type: "sos_event",
      target_id: sos.id,
      meta: { patient_id: data.patientId, notified: recipients.length },
    });
    if (auditError) throw new Error(auditError.message);

    return { sos, notified: recipients.length };
  });

export const refillChamber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId: string; levelAfter: number; note?: string }) =>
    patientInput
      .extend({ levelAfter: z.number().min(0).max(100), note: z.string().max(200).optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: owns } = await supabase.rpc("owns_patient", { _patient_id: data.patientId });
    if (!owns) throw new Error("Not allowed");

    const { data: device } = await supabase
      .from("devices")
      .select("id")
      .eq("patient_id", data.patientId)
      .maybeSingle();

    await supabase.from("fluid_refills").insert({
      patient_id: data.patientId,
      device_id: device?.id ?? null,
      level_after: data.levelAfter,
      note: data.note ?? null,
    });
    if (device) {
      await supabase.from("devices").update({ fluid_level: data.levelAfter }).eq("id", device.id);
    }
    return { ok: true };
  });

export const listRefills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId: string }) => patientInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("fluid_refills")
      .select("*")
      .eq("patient_id", data.patientId)
      .order("created_at", { ascending: false })
      .limit(20);
    return rows ?? [];
  });

/* ------------------------------------------------------------------ */
/* Notifications & profile                                            */
/* ------------------------------------------------------------------ */

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notifications")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    return data ?? [];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    return data;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      full_name?: string;
      phone?: string;
      theme?: string;
      voice_alerts?: boolean;
      notify_email?: boolean;
      language?: string;
    }) =>
      z
        .object({
          full_name: z.string().min(1).max(80).optional(),
          phone: z.string().max(30).optional(),
          theme: z.enum(["light", "dark", "system"]).optional(),
          voice_alerts: z.boolean().optional(),
          notify_email: z.boolean().optional(),
          language: z.enum(["en", "hi", "kn"]).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      full_name?: string;
      phone?: string;
      theme?: string;
      voice_alerts?: boolean;
      notify_email?: boolean;
      language?: string;
    } = {};
    if (data.full_name !== undefined) patch.full_name = data.full_name;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.theme !== undefined) patch.theme = data.theme;
    if (data.voice_alerts !== undefined) patch.voice_alerts = data.voice_alerts;
    if (data.notify_email !== undefined) patch.notify_email = data.notify_email;
    if (data.language !== undefined) patch.language = data.language;

    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateThresholds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId: string; spo2: number; bpmHigh: number; tempMax: number }) =>
    patientInput
      .extend({
        spo2: z.number().min(80).max(99),
        bpmHigh: z.number().min(80).max(200),
        tempMax: z.number().min(36).max(42),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("patients")
      .update({
        spo2_threshold: data.spo2,
        bpm_high_threshold: data.bpmHigh,
        temp_threshold: data.tempMax,
      })
      .eq("id", data.patientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Reports                                                            */
/* ------------------------------------------------------------------ */

export const buildReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId: string; days: number; format?: string }) =>
    patientInput
      .extend({
        days: z.number().int().min(1).max(180),
        format: z.enum(["pdf", "csv", "json"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();

    // RLS + can_view_patient guarantee no cross-patient exposure.
    const { data: allowed } = await supabase.rpc("can_view_patient", {
      _patient_id: data.patientId,
    });
    if (!allowed) throw new Error("You are not authorized to report on this patient.");

    const [patient, device, plan, sessions, adherence, alerts, health, env, battery, sos, refills] =
      await Promise.all([
        supabase.from("patients").select("*").eq("id", data.patientId).maybeSingle(),
        supabase.from("devices").select("*").eq("patient_id", data.patientId).maybeSingle(),
        supabase
          .from("care_plans")
          .select("*, doctors(full_name, specialty)")
          .eq("patient_id", data.patientId)
          .eq("status", "published")
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("nebulization_sessions")
          .select("*")
          .eq("patient_id", data.patientId)
          .gte("started_at", since)
          .order("started_at", { ascending: false }),
        supabase
          .from("adherence_records")
          .select("*")
          .eq("patient_id", data.patientId)
          .gte("scheduled_for", since.slice(0, 10)),
        supabase
          .from("alerts")
          .select("*")
          .eq("patient_id", data.patientId)
          .gte("created_at", since)
          .order("created_at", { ascending: false }),
        supabase
          .from("health_telemetry")
          .select("bpm, spo2, body_temperature, recorded_at")
          .eq("patient_id", data.patientId)
          .gte("recorded_at", since)
          .order("recorded_at", { ascending: false })
          .limit(3000),
        supabase
          .from("environmental_telemetry")
          .select("ambient_temperature, humidity, aqi, recorded_at")
          .eq("patient_id", data.patientId)
          .gte("recorded_at", since)
          .order("recorded_at", { ascending: false })
          .limit(1500),
        supabase
          .from("battery_telemetry")
          .select("percentage, voltage, current, cell_temperature, charging, recorded_at")
          .eq("patient_id", data.patientId)
          .gte("recorded_at", since)
          .order("recorded_at", { ascending: false })
          .limit(1500),
        supabase
          .from("sos_events")
          .select("*")
          .eq("patient_id", data.patientId)
          .gte("created_at", since)
          .order("created_at", { ascending: false }),
        supabase
          .from("fluid_refills")
          .select("*")
          .eq("patient_id", data.patientId)
          .gte("created_at", since)
          .order("created_at", { ascending: false }),
      ]);

    const vitals = health.data ?? [];
    const avg = (key: "bpm" | "spo2" | "body_temperature") => {
      const nums = vitals.map((v: any) => Number(v[key])).filter((n) => Number.isFinite(n));
      return nums.length
        ? Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1))
        : null;
    };
    const min = (key: "spo2") => {
      const nums = vitals.map((v: any) => Number(v[key])).filter((n) => Number.isFinite(n));
      return nums.length ? Math.min(...nums) : null;
    };
    const max = (key: "bpm" | "body_temperature") => {
      const nums = vitals.map((v: any) => Number(v[key])).filter((n) => Number.isFinite(n));
      return nums.length ? Math.max(...nums) : null;
    };

    const adherenceRows = adherence.data ?? [];
    const payload = {
      generatedAt: new Date().toISOString(),
      rangeDays: data.days,
      rangeStart: since,
      patient: patient.data,
      device: device.data,
      carePlan: plan.data,
      sessions: sessions.data ?? [],
      adherence: adherenceRows,
      adherenceSummary: {
        scheduled: adherenceRows.length,
        completed: adherenceRows.filter((a: any) => a.status === "completed").length,
        partial: adherenceRows.filter((a: any) => a.status === "partial").length,
        missed: adherenceRows.filter((a: any) => a.status === "missed").length,
      },
      alerts: alerts.data ?? [],
      sos: sos.data ?? [],
      refills: refills.data ?? [],
      series: {
        health: vitals,
        environment: env.data ?? [],
        battery: battery.data ?? [],
      },
      vitals: {
        samples: vitals.length,
        avgBpm: avg("bpm"),
        maxBpm: max("bpm"),
        avgSpo2: avg("spo2"),
        minSpo2: min("spo2"),
        avgTemp: avg("body_temperature"),
        maxTemp: max("body_temperature"),
      },
    };

    await supabase.from("reports").insert({
      patient_id: data.patientId,
      requested_by: userId,
      kind: "clinical",
      format: data.format ?? "pdf",
      range_start: since,
      range_end: new Date().toISOString(),
      payload,
    });
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "report.generate",
      target_type: "patient",
      target_id: data.patientId,
      meta: { days: data.days, format: data.format ?? "pdf" },
    });

    return payload;
  });

/* ------------------------------------------------------------------ */
/* Device simulator (labelled, dev/demo telemetry source)             */
/* ------------------------------------------------------------------ */

export const pushSimulatedTelemetry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId: string }) => patientInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: owns } = await supabase.rpc("owns_patient", { _patient_id: data.patientId });
    if (!owns) throw new Error("Not allowed");

    const { data: device } = await supabase
      .from("devices")
      .select("*")
      .eq("patient_id", data.patientId)
      .maybeSingle();
    const { data: last } = await supabase
      .from("health_telemetry")
      .select("bpm, spo2, body_temperature")
      .eq("patient_id", data.patientId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const drift = (v: number, d: number, lo: number, hi: number) =>
      Math.min(hi, Math.max(lo, v + (Math.random() - 0.5) * d));

    const bpm = Math.round(drift(Number(last?.bpm ?? 78), 6, 52, 132));
    const spo2 = Math.round(drift(Number(last?.spo2 ?? 96), 2.4, 85, 100));
    const temp = Number(drift(Number(last?.body_temperature ?? 36.8), 0.3, 36, 38.6).toFixed(1));
    const now = new Date().toISOString();

    await Promise.all([
      supabase.from("health_telemetry").insert({
        patient_id: data.patientId,
        device_id: device?.id ?? null,
        bpm,
        spo2,
        body_temperature: temp,
        recorded_at: now,
      }),
      supabase.from("environmental_telemetry").insert({
        patient_id: data.patientId,
        device_id: device?.id ?? null,
        ambient_temperature: Number((23 + Math.random() * 3).toFixed(1)),
        humidity: Math.round(45 + Math.random() * 15),
        aqi: Math.round(50 + Math.random() * 40),
        simulated: true,
        recorded_at: now,
      }),
      supabase.from("battery_telemetry").insert({
        patient_id: data.patientId,
        device_id: device?.id ?? null,
        percentage: Math.max(5, Math.round(Number(device?.fluid_level ?? 60) - Math.random() * 2)),
        voltage: Number((3.7 + Math.random() * 0.3).toFixed(2)),
        current: Number((0.4 + Math.random() * 0.4).toFixed(2)),
        power: Number((1.6 + Math.random()).toFixed(2)),
        cell_temperature: Number((29 + Math.random() * 5).toFixed(1)),
        fluid_level: device?.fluid_level ?? null,
        recorded_at: now,
      }),
      device
        ? supabase
            .from("devices")
            .update({ last_seen_at: now, status: "online", mqtt_connected: true })
            .eq("id", device.id)
        : Promise.resolve(),
    ]);

    return { bpm, spo2, temp, recordedAt: now };
  });

/**
 * Persists a REAL reading received from the ESP32 (via Firebase Realtime
 * Database) so history, reports, adherence and the alert engine work on
 * genuine measurements. Nothing is generated or interpolated here.
 */
export const ingestDeviceTelemetry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      patientId: string;
      bpm?: number | null;
      spo2?: number | null;
      bodyTemperature?: number | null;
      ambientTemperature?: number | null;
      batteryPercentage?: number | null;
      batteryVoltage?: number | null;
      batteryCurrent?: number | null;
      batteryPower?: number | null;
      batteryTemperature?: number | null;
      relay?: boolean | null;
    }) =>
      patientInput
        .extend({
          bpm: z.number().nullable().optional(),
          spo2: z.number().nullable().optional(),
          bodyTemperature: z.number().nullable().optional(),
          ambientTemperature: z.number().nullable().optional(),
          batteryPercentage: z.number().nullable().optional(),
          batteryVoltage: z.number().nullable().optional(),
          batteryCurrent: z.number().nullable().optional(),
          batteryPower: z.number().nullable().optional(),
          batteryTemperature: z.number().nullable().optional(),
          relay: z.boolean().nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: owns } = await supabase.rpc("owns_patient", { _patient_id: data.patientId });
    if (!owns) throw new Error("Not allowed");

    const { data: device } = await supabase
      .from("devices")
      .select("id")
      .eq("patient_id", data.patientId)
      .maybeSingle();

    const now = new Date().toISOString();
    const writes: Array<PromiseLike<unknown>> = [];

    if (data.bpm != null || data.spo2 != null || data.bodyTemperature != null) {
      writes.push(
        supabase.from("health_telemetry").insert({
          patient_id: data.patientId,
          device_id: device?.id ?? null,
          bpm: data.bpm ?? null,
          spo2: data.spo2 ?? null,
          body_temperature: data.bodyTemperature ?? null,
          recorded_at: now,
          source: "esp32",
        }),
      );
    }
    if (data.ambientTemperature != null) {
      writes.push(
        supabase.from("environmental_telemetry").insert({
          patient_id: data.patientId,
          device_id: device?.id ?? null,
          ambient_temperature: data.ambientTemperature,
          // Humidity and AQI are not provided by the current firmware.
          humidity: null,
          aqi: null,
          simulated: false,
          recorded_at: now,
          source: "esp32",
        }),
      );
    }
    if (
      data.batteryPercentage != null ||
      data.batteryVoltage != null ||
      data.batteryCurrent != null
    ) {
      writes.push(
        supabase.from("battery_telemetry").insert({
          patient_id: data.patientId,
          device_id: device?.id ?? null,
          percentage: data.batteryPercentage ?? null,
          voltage: data.batteryVoltage ?? null,
          current: data.batteryCurrent ?? null,
          power: data.batteryPower ?? null,
          cell_temperature: data.batteryTemperature ?? null,
          recorded_at: now,
          source: "esp32",
        }),
      );
    }
    if (device) {
      writes.push(
        supabase
          .from("devices")
          .update({
            last_seen_at: now,
            status: "online",
            cloud_connected: true,
            nebulizer_state: data.relay ? "on" : "off",
          })
          .eq("id", device.id),
      );
    }

    await Promise.all(writes);
    return { recordedAt: now, stored: writes.length };
  });

/* ------------------------------------------------------------------ */
/* AI assistant (RBAC-scoped, server-side model access)               */
/* ------------------------------------------------------------------ */

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { question: string; patientId?: string }) =>
    z
      .object({ question: z.string().min(2).max(600), patientId: z.string().uuid().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let scope = "No patient record is linked to this account yet.";
    if (data.patientId) {
      const { data: allowed } = await supabase.rpc("can_view_patient", {
        _patient_id: data.patientId,
      });
      if (!allowed) throw new Error("You are not authorized to ask about this patient.");

      const [patient, health, plan, adherence, alerts, sessions] = await Promise.all([
        supabase
          .from("patients")
          .select("full_name, condition, spo2_threshold")
          .eq("id", data.patientId)
          .maybeSingle(),
        supabase
          .from("health_telemetry")
          .select("bpm, spo2, body_temperature, recorded_at")
          .eq("patient_id", data.patientId)
          .order("recorded_at", { ascending: false })
          .limit(40),
        supabase
          .from("care_plans")
          .select("medication, dosage, duration_minutes, frequency_per_day, instructions")
          .eq("patient_id", data.patientId)
          .eq("status", "published")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("adherence_records")
          .select("scheduled_for, status")
          .eq("patient_id", data.patientId)
          .order("scheduled_for", { ascending: false })
          .limit(30),
        supabase
          .from("alerts")
          .select("type, severity, message, status, created_at")
          .eq("patient_id", data.patientId)
          .order("created_at", { ascending: false })
          .limit(15),
        supabase
          .from("nebulization_sessions")
          .select("started_at, status, elapsed_seconds, prescribed_seconds, medication")
          .eq("patient_id", data.patientId)
          .order("started_at", { ascending: false })
          .limit(10),
      ]);

      scope = JSON.stringify({
        patient: patient.data,
        recentVitals: health.data,
        carePlan: plan.data,
        adherence: adherence.data,
        alerts: alerts.data,
        sessions: sessions.data,
      });
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { answer: "The AI assistant is not configured yet." };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are SmartNeb Assistant, an informational assistant inside a respiratory-therapy IoT platform. Answer only from the authorized JSON context provided. Be concise, use plain language, cite concrete numbers and dates. You are not a doctor and must never give a diagnosis or change a prescription; recommend contacting the care team for clinical decisions.",
          },
          { role: "user", content: `Authorized context:\n${scope}\n\nQuestion: ${data.question}` },
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return { answer: "Rate limit reached — please try again shortly." };
      return { answer: "The assistant is temporarily unavailable. Please try again." };
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return { answer: json.choices?.[0]?.message?.content ?? "No answer returned." };
  });
