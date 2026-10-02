import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Ctx = { supabase: any; userId: string };

async function assertStaff(context: Ctx) {
  const { data, error } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: administrator access required.");
}

async function audit(
  context: Ctx,
  action: string,
  targetType: string,
  targetId: string,
  meta: Record<string, unknown>,
) {
  await context.supabase.from("audit_logs").insert({
    actor_id: context.userId,
    action,
    target_type: targetType,
    target_id: targetId,
    meta,
  });
}

/* ------------------------------------------------------------------ */
/* Platform overview                                                  */
/* ------------------------------------------------------------------ */

export type AdminOverview = {
  users: { total: number; active: number; inactive: number };
  roles: { patient: number; doctor: number; caregiver: number; admin: number; super_admin: number };
  devices: {
    total: number;
    online: number;
    offline: number;
    maintenance: number;
    disabled: number;
    unassigned: number;
    mqttConnected: number;
    cloudConnected: number;
    lowFluid: number;
  };
  telemetry: {
    lastHour: number;
    last24h: number;
    lastRecordedAt: string | null;
    patientsReporting: number;
    stalePatients: number;
  };
  alerts: { active: number; critical: number; warning: number; acknowledged: number };
  sos: { active: number; acknowledged: number; last24h: number };
  sessions: { running: number; completedToday: number };
  unassignedPatients: number;
};

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    await assertStaff(context as Ctx);
    const { supabase } = context;
    const now = Date.now();
    const hourAgo = new Date(now - 3_600_000).toISOString();
    const dayAgo = new Date(now - 86_400_000).toISOString();
    const dayStart = new Date(new Date().toISOString().slice(0, 10)).toISOString();

    const [profiles, roles, devices, telemetry, alerts, sos, sessions, patients, dpa, cpa] =
      await Promise.all([
        supabase.from("profiles").select("id, is_active"),
        supabase.from("user_roles").select("role"),
        supabase.from("devices").select("*"),
        supabase
          .from("health_telemetry")
          .select("patient_id, recorded_at")
          .gte("recorded_at", dayAgo)
          .order("recorded_at", { ascending: false })
          .limit(5000),
        supabase.from("alerts").select("severity, status"),
        supabase.from("sos_events").select("status, created_at"),
        supabase.from("nebulization_sessions").select("status, ended_at"),
        supabase.from("patients").select("id").is("deleted_at", null),
        supabase.from("doctor_patient_assignments").select("patient_id"),
        supabase.from("caregiver_patient_assignments").select("patient_id"),
      ]);

    const profileRows = profiles.data ?? [];
    const roleRows = roles.data ?? [];
    const deviceRows = devices.data ?? [];
    const telemetryRows = telemetry.data ?? [];
    const alertRows = alerts.data ?? [];
    const sosRows = sos.data ?? [];
    const sessionRows = sessions.data ?? [];

    const reporting = new Set(
      telemetryRows.filter((t: any) => t.recorded_at >= hourAgo).map((t: any) => t.patient_id),
    );
    const assigned = new Set([
      ...(dpa.data ?? []).map((r: any) => r.patient_id),
      ...(cpa.data ?? []).map((r: any) => r.patient_id),
    ]);
    const countRole = (r: string) => roleRows.filter((x: any) => x.role === r).length;

    return {
      users: {
        total: profileRows.length,
        active: profileRows.filter((p: any) => p.is_active !== false).length,
        inactive: profileRows.filter((p: any) => p.is_active === false).length,
      },
      roles: {
        patient: countRole("patient"),
        doctor: countRole("doctor"),
        caregiver: countRole("caregiver"),
        admin: countRole("admin"),
        super_admin: countRole("super_admin"),
      },
      devices: {
        total: deviceRows.length,
        online: deviceRows.filter((d: any) => d.status === "online").length,
        offline: deviceRows.filter((d: any) => d.status === "offline").length,
        maintenance: deviceRows.filter((d: any) => d.status === "maintenance").length,
        disabled: deviceRows.filter((d: any) => d.status === "disabled").length,
        unassigned: deviceRows.filter((d: any) => !d.patient_id).length,
        mqttConnected: deviceRows.filter((d: any) => d.mqtt_connected).length,
        cloudConnected: deviceRows.filter((d: any) => d.cloud_connected).length,
        lowFluid: deviceRows.filter((d: any) => Number(d.fluid_level ?? 100) < 20).length,
      },
      telemetry: {
        lastHour: telemetryRows.filter((t: any) => t.recorded_at >= hourAgo).length,
        last24h: telemetryRows.length,
        lastRecordedAt: telemetryRows[0]?.recorded_at ?? null,
        patientsReporting: reporting.size,
        stalePatients: (patients.data ?? []).filter((p: any) => !reporting.has(p.id)).length,
      },
      alerts: {
        active: alertRows.filter((a: any) => a.status === "active").length,
        critical: alertRows.filter((a: any) => a.status === "active" && a.severity === "critical")
          .length,
        warning: alertRows.filter((a: any) => a.status === "active" && a.severity === "warning")
          .length,
        acknowledged: alertRows.filter((a: any) => a.status === "acknowledged").length,
      },
      sos: {
        active: sosRows.filter((s: any) => s.status === "active").length,
        acknowledged: sosRows.filter((s: any) => s.status === "acknowledged").length,
        last24h: sosRows.filter((s: any) => s.created_at >= dayAgo).length,
      },
      sessions: {
        running: sessionRows.filter((s: any) =>
          ["pending", "starting", "running", "paused"].includes(s.status),
        ).length,
        completedToday: sessionRows.filter(
          (s: any) => s.status === "completed" && s.ended_at && s.ended_at >= dayStart,
        ).length,
      },
      unassignedPatients: (patients.data ?? []).filter((p: any) => !assigned.has(p.id)).length,
    };
  });

/* ------------------------------------------------------------------ */
/* Users                                                              */
/* ------------------------------------------------------------------ */

export type AdminUserRow = {
  id: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  roles: string[];
  createdAt: string;
  patientId: string | null;
  mrn: string | null;
  doctorId: string | null;
  specialty: string | null;
  caregiverId: string | null;
  relation: string | null;
};

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUserRow[]> => {
    await assertStaff(context as Ctx);
    const { supabase } = context;
    const [profiles, roles, patients, doctors, caregivers] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("patients").select("id, user_id, mrn").is("deleted_at", null),
      supabase.from("doctors").select("id, user_id, specialty"),
      supabase.from("caregivers").select("id, user_id, relation"),
    ]);

    const roleBy = new Map<string, string[]>();
    for (const r of roles.data ?? []) {
      roleBy.set(r.user_id, [...(roleBy.get(r.user_id) ?? []), r.role]);
    }
    const patientBy = new Map(
      (patients.data ?? []).filter((p: any) => p.user_id).map((p: any) => [p.user_id, p]),
    );
    const doctorBy = new Map(
      (doctors.data ?? []).filter((d: any) => d.user_id).map((d: any) => [d.user_id, d]),
    );
    const caregiverBy = new Map(
      (caregivers.data ?? []).filter((c: any) => c.user_id).map((c: any) => [c.user_id, c]),
    );

    return (profiles.data ?? []).map((p: any) => ({
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      phone: p.phone,
      isActive: p.is_active !== false,
      roles: roleBy.get(p.id) ?? [],
      createdAt: p.created_at,
      patientId: patientBy.get(p.id)?.id ?? null,
      mrn: patientBy.get(p.id)?.mrn ?? null,
      doctorId: doctorBy.get(p.id)?.id ?? null,
      specialty: doctorBy.get(p.id)?.specialty ?? null,
      caregiverId: caregiverBy.get(p.id)?.id ?? null,
      relation: caregiverBy.get(p.id)?.relation ?? null,
    }));
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; active: boolean }) =>
    z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context as Ctx);
    const { error } = await context.supabase
      .from("profiles")
      .update({ is_active: data.active })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    await audit(
      context as Ctx,
      data.active ? "user.activate" : "user.deactivate",
      "profile",
      data.userId,
      { active: data.active },
    );
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Care team assignments                                              */
/* ------------------------------------------------------------------ */

export type AdminPatientRow = {
  id: string;
  fullName: string;
  mrn: string;
  condition: string | null;
  userLinked: boolean;
  isActive: boolean;
  doctors: { id: string; name: string }[];
  caregivers: { id: string; name: string }[];
  deviceCode: string | null;
  deviceStatus: string | null;
  lastSeenAt: string | null;
  lastTelemetryAt: string | null;
  activeAlerts: number;
  activeSOS: number;
};

export const listAdminPatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPatientRow[]> => {
    await assertStaff(context as Ctx);
    const { supabase } = context;
    const [patients, doctors, caregivers, dpa, cpa, devices, alerts, sos, profiles, telemetry] =
      await Promise.all([
        supabase.from("patients").select("*").is("deleted_at", null).order("full_name"),
        supabase.from("doctors").select("id, full_name"),
        supabase.from("caregivers").select("id, full_name"),
        supabase.from("doctor_patient_assignments").select("patient_id, doctor_id"),
        supabase.from("caregiver_patient_assignments").select("patient_id, caregiver_id"),
        supabase.from("devices").select("patient_id, device_code, status, last_seen_at"),
        supabase.from("alerts").select("patient_id").eq("status", "active"),
        supabase.from("sos_events").select("patient_id").neq("status", "resolved"),
        supabase.from("profiles").select("id, is_active"),
        supabase
          .from("health_telemetry")
          .select("patient_id, recorded_at")
          .order("recorded_at", { ascending: false })
          .limit(2000),
      ]);

    const doctorBy = new Map((doctors.data ?? []).map((d: any) => [d.id, d.full_name]));
    const caregiverBy = new Map((caregivers.data ?? []).map((c: any) => [c.id, c.full_name]));
    const activeBy = new Map((profiles.data ?? []).map((p: any) => [p.id, p.is_active !== false]));
    const deviceBy = new Map(
      (devices.data ?? []).filter((d: any) => d.patient_id).map((d: any) => [d.patient_id, d]),
    );
    const lastTelemetry = new Map<string, string>();
    for (const t of telemetry.data ?? []) {
      if (!lastTelemetry.has(t.patient_id)) lastTelemetry.set(t.patient_id, t.recorded_at);
    }

    return (patients.data ?? []).map((p: any) => ({
      id: p.id,
      fullName: p.full_name,
      mrn: p.mrn,
      condition: p.condition,
      userLinked: Boolean(p.user_id),
      isActive: p.user_id ? (activeBy.get(p.user_id) ?? true) : true,
      doctors: (dpa.data ?? [])
        .filter((a: any) => a.patient_id === p.id)
        .map((a: any) => ({ id: a.doctor_id, name: doctorBy.get(a.doctor_id) ?? "Doctor" })),
      caregivers: (cpa.data ?? [])
        .filter((a: any) => a.patient_id === p.id)
        .map((a: any) => ({
          id: a.caregiver_id,
          name: caregiverBy.get(a.caregiver_id) ?? "Caregiver",
        })),
      deviceCode: deviceBy.get(p.id)?.device_code ?? null,
      deviceStatus: deviceBy.get(p.id)?.status ?? null,
      lastSeenAt: deviceBy.get(p.id)?.last_seen_at ?? null,
      lastTelemetryAt: lastTelemetry.get(p.id) ?? null,
      activeAlerts: (alerts.data ?? []).filter((a: any) => a.patient_id === p.id).length,
      activeSOS: (sos.data ?? []).filter((s: any) => s.patient_id === p.id).length,
    }));
  });

export type AdminStaff = {
  doctors: { id: string; name: string; specialty: string; linked: boolean; patients: number }[];
  caregivers: { id: string; name: string; relation: string; linked: boolean; patients: number }[];
};

export const listAdminStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminStaff> => {
    await assertStaff(context as Ctx);
    const { supabase } = context;
    const [doctors, caregivers, dpa, cpa] = await Promise.all([
      supabase.from("doctors").select("*").order("full_name"),
      supabase.from("caregivers").select("*").order("full_name"),
      supabase.from("doctor_patient_assignments").select("doctor_id"),
      supabase.from("caregiver_patient_assignments").select("caregiver_id"),
    ]);
    return {
      doctors: (doctors.data ?? []).map((d: any) => ({
        id: d.id,
        name: d.full_name,
        specialty: d.specialty,
        linked: Boolean(d.user_id),
        patients: (dpa.data ?? []).filter((a: any) => a.doctor_id === d.id).length,
      })),
      caregivers: (caregivers.data ?? []).map((c: any) => ({
        id: c.id,
        name: c.full_name,
        relation: c.relation,
        linked: Boolean(c.user_id),
        patients: (cpa.data ?? []).filter((a: any) => a.caregiver_id === c.id).length,
      })),
    };
  });

export const setAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      patientId: string;
      kind: "doctor" | "caregiver";
      staffId: string;
      action: "assign" | "unassign";
    }) =>
      z
        .object({
          patientId: z.string().uuid(),
          kind: z.enum(["doctor", "caregiver"]),
          staffId: z.string().uuid(),
          action: z.enum(["assign", "unassign"]),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context as Ctx);
    const supabase = context.supabase as any;
    const table =
      data.kind === "doctor" ? "doctor_patient_assignments" : "caregiver_patient_assignments";
    const column = data.kind === "doctor" ? "doctor_id" : "caregiver_id";

    if (data.action === "assign") {
      const { data: existing } = await supabase
        .from(table)
        .select("id")
        .eq("patient_id", data.patientId)
        .eq(column, data.staffId)
        .maybeSingle();
      if (!existing) {
        const { error } = await supabase
          .from(table)
          .insert({ patient_id: data.patientId, [column]: data.staffId });
        if (error) throw new Error(error.message);
      }
    } else {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("patient_id", data.patientId)
        .eq(column, data.staffId);
      if (error) throw new Error(error.message);
    }

    await audit(context as Ctx, `assignment.${data.action}`, data.kind, data.staffId, {
      patient_id: data.patientId,
    });
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Devices                                                            */
/* ------------------------------------------------------------------ */

export type AdminDeviceRow = {
  id: string;
  deviceCode: string;
  status: string;
  firmware: string;
  mqttConnected: boolean;
  cloudConnected: boolean;
  nebulizerState: string;
  fluidLevel: number;
  lastSeenAt: string | null;
  registeredAt: string;
  patientId: string | null;
  patientName: string | null;
  mrn: string | null;
  lastTelemetryAt: string | null;
};

export const listAdminDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminDeviceRow[]> => {
    await assertStaff(context as Ctx);
    const { supabase } = context;
    const [devices, patients, telemetry] = await Promise.all([
      supabase.from("devices").select("*").order("device_code"),
      supabase.from("patients").select("id, full_name, mrn"),
      supabase
        .from("health_telemetry")
        .select("device_id, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(2000),
    ]);
    const patientBy = new Map((patients.data ?? []).map((p: any) => [p.id, p]));
    const lastByDevice = new Map<string, string>();
    for (const t of telemetry.data ?? []) {
      if (t.device_id && !lastByDevice.has(t.device_id))
        lastByDevice.set(t.device_id, t.recorded_at);
    }
    return (devices.data ?? []).map((d: any) => ({
      id: d.id,
      deviceCode: d.device_code,
      status: d.status,
      firmware: d.firmware,
      mqttConnected: d.mqtt_connected,
      cloudConnected: d.cloud_connected,
      nebulizerState: d.nebulizer_state,
      fluidLevel: Number(d.fluid_level ?? 0),
      lastSeenAt: d.last_seen_at,
      registeredAt: d.registered_at,
      patientId: d.patient_id,
      patientName: d.patient_id ? (patientBy.get(d.patient_id)?.full_name ?? null) : null,
      mrn: d.patient_id ? (patientBy.get(d.patient_id)?.mrn ?? null) : null,
      lastTelemetryAt: lastByDevice.get(d.id) ?? null,
    }));
  });

export const registerDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { deviceCode: string; firmware?: string; patientId?: string | null }) =>
    z
      .object({
        deviceCode: z.string().trim().min(3).max(40),
        firmware: z.string().trim().max(20).optional(),
        patientId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context as Ctx);
    const { data: device, error } = await context.supabase
      .from("devices")
      .insert({
        device_code: data.deviceCode.toUpperCase(),
        firmware: data.firmware?.trim() || "1.0.0",
        patient_id: data.patientId ?? null,
        status: "offline",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await audit(context as Ctx, "device.register", "device", device.id, {
      device_code: device.device_code,
    });
    return { ok: true, id: device.id as string };
  });

export const updateDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      deviceId: string;
      patientId?: string | null;
      status?: "online" | "offline" | "maintenance" | "disabled";
      firmware?: string;
    }) =>
      z
        .object({
          deviceId: z.string().uuid(),
          patientId: z.string().uuid().nullable().optional(),
          status: z.enum(["online", "offline", "maintenance", "disabled"]).optional(),
          firmware: z.string().trim().max(20).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context as Ctx);
    const patch: Record<string, unknown> = {};
    if (data.patientId !== undefined) patch["patient_id"] = data.patientId;
    if (data.status) patch["status"] = data.status;
    if (data.firmware) patch["firmware"] = data.firmware;
    if (!Object.keys(patch).length) return { ok: true };

    const { error } = await context.supabase
      .from("devices")
      .update(patch as any)
      .eq("id", data.deviceId);
    if (error) throw new Error(error.message);
    await audit(context as Ctx, "device.update", "device", data.deviceId, patch);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Audit logs                                                         */
/* ------------------------------------------------------------------ */

export type AuditRow = {
  id: string;
  action: string;
  actorName: string | null;
  targetType: string | null;
  targetId: string | null;
  meta: string | null;
  createdAt: string;
};

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditRow[]> => {
    await assertStaff(context as Ctx);
    const { supabase } = context;
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) throw new Error(error.message);

    const actorIds = [...new Set((data ?? []).map((r: any) => r.actor_id).filter(Boolean))];
    const { data: profiles } = actorIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [] as any[] };
    const nameBy = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));

    return (data ?? []).map((r: any) => ({
      id: r.id,
      action: r.action,
      actorName: r.actor_name ?? (r.actor_id ? (nameBy.get(r.actor_id) ?? null) : null),
      targetType: r.target_type,
      targetId: r.target_id,
      meta: r.meta ? JSON.stringify(r.meta) : null,
      createdAt: r.created_at,
    }));
  });

/* ------------------------------------------------------------------ */
/* Alert monitoring                                                   */
/* ------------------------------------------------------------------ */

export type AdminAlertRow = {
  id: string;
  patientName: string;
  mrn: string;
  type: string;
  severity: string;
  status: string;
  message: string;
  value: number | null;
  threshold: number | null;
  createdAt: string;
};

export const listAdminAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAlertRow[]> => {
    await assertStaff(context as Ctx);
    const { supabase } = context;
    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const ids = [...new Set((data ?? []).map((a: any) => a.patient_id))];
    const { data: patients } = ids.length
      ? await supabase.from("patients").select("id, full_name, mrn").in("id", ids)
      : { data: [] as any[] };
    const by = new Map((patients ?? []).map((p: any) => [p.id, p]));
    return (data ?? []).map((a: any) => ({
      id: a.id,
      patientName: by.get(a.patient_id)?.full_name ?? "Patient",
      mrn: by.get(a.patient_id)?.mrn ?? "--",
      type: a.type,
      severity: a.severity,
      status: a.status,
      message: a.message,
      value: a.value == null ? null : Number(a.value),
      threshold: a.threshold == null ? null : Number(a.threshold),
      createdAt: a.created_at,
    }));
  });
