import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SOSVitals = {
  bpm?: number | null;
  spo2?: number | null;
  body_temperature?: number | null;
  recorded_at?: string | null;
} | null;

export type SOSEventRow = {
  id: string;
  patient_id: string;
  patientName: string;
  mrn: string;
  condition: string | null;
  source: string;
  status: "active" | "acknowledged" | "resolved";
  severity: "critical" | "warning" | "info";
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  vitals: SOSVitals;
  deviceCode: string | null;
  deviceStatus: string | null;
  deviceLastSeen: string | null;
  fluidLevel: number | null;
  spo2Threshold: number;
};

function severityFor(vitals: SOSVitals, spo2Threshold: number): "critical" | "warning" | "info" {
  const spo2 = vitals?.spo2 == null ? null : Number(vitals.spo2);
  const bpm = vitals?.bpm == null ? null : Number(vitals.bpm);
  if (spo2 != null && spo2 < spo2Threshold - 3) return "critical";
  if (bpm != null && (bpm > 140 || bpm < 45)) return "critical";
  if (spo2 != null && spo2 < spo2Threshold) return "warning";
  // A manual SOS is always urgent by definition.
  return "critical";
}

const listInput = z.object({
  patientId: z.string().uuid().optional(),
  includeResolved: z.boolean().optional(),
});

export const listSOSEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId?: string; includeResolved?: boolean } | undefined) =>
    listInput.parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<SOSEventRow[]> => {
    const { supabase } = context;
    let query = supabase
      .from("sos_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data.patientId) query = query.eq("patient_id", data.patientId);
    if (!data.includeResolved) query = query.neq("status", "resolved");

    const { data: events, error } = await query;
    if (error) throw new Error(error.message);
    if (!events?.length) return [];

    const ids = [...new Set(events.map((e) => e.patient_id))];
    const [patients, devices] = await Promise.all([
      supabase
        .from("patients")
        .select("id, full_name, mrn, condition, spo2_threshold")
        .in("id", ids),
      supabase
        .from("devices")
        .select("patient_id, device_code, status, last_seen_at, fluid_level")
        .in("patient_id", ids),
    ]);
    const patientBy = new Map((patients.data ?? []).map((p) => [p.id, p]));
    const deviceBy = new Map((devices.data ?? []).map((d) => [d.patient_id as string, d]));

    return events.map((e) => {
      const p = patientBy.get(e.patient_id);
      const d = deviceBy.get(e.patient_id);
      const vitals = (e.vitals ?? null) as SOSVitals;
      const spo2Threshold = Number(p?.spo2_threshold ?? 92);
      return {
        id: e.id,
        patient_id: e.patient_id,
        patientName: p?.full_name ?? "Patient",
        mrn: p?.mrn ?? "--",
        condition: p?.condition ?? null,
        source: e.source,
        status: e.status as SOSEventRow["status"],
        severity: severityFor(vitals, spo2Threshold),
        created_at: e.created_at,
        acknowledged_at: e.acknowledged_at,
        resolved_at: e.resolved_at,
        vitals,
        deviceCode: d?.device_code ?? null,
        deviceStatus: d?.status ?? null,
        deviceLastSeen: d?.last_seen_at ?? null,
        fluidLevel: d?.fluid_level == null ? null : Number(d.fluid_level),
        spo2Threshold,
      };
    });
  });

export const respondToSOS = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sosId: string; action: "acknowledge" | "resolve"; note?: string }) =>
    z
      .object({
        sosId: z.string().uuid(),
        action: z.enum(["acknowledge", "resolve"]),
        note: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();

    const { data: event } = await supabase
      .from("sos_events")
      .select("id, patient_id, status")
      .eq("id", data.sosId)
      .maybeSingle();
    if (!event) throw new Error("This emergency is not visible to your account.");

    const patch =
      data.action === "resolve"
        ? { status: "resolved" as const, resolved_at: now, resolved_by: userId }
        : { status: "acknowledged" as const, acknowledged_at: now, acknowledged_by: userId };

    const { error } = await supabase.from("sos_events").update(patch).eq("id", data.sosId);
    if (error) throw new Error(error.message);

    const [{ data: responder }, { data: patient }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      supabase.from("patients").select("user_id").eq("id", event.patient_id).maybeSingle(),
    ]);

    const { insertNotifications, careTeamUserIds } = await import("./notify.server");
    const team = await careTeamUserIds(event.patient_id, [userId]);
    const verb = data.action === "resolve" ? "resolved" : "acknowledged";
    const who = responder?.full_name ?? "A care team member";

    const rows: {
      user_id: string;
      patient_id: string;
      type: string;
      title: string;
      body: string;
    }[] = [];
    if (patient?.user_id) {
      rows.push({
        user_id: patient.user_id,
        patient_id: event.patient_id,
        type: "sos",
        title:
          data.action === "resolve"
            ? "Your emergency has been resolved"
            : "Your care team is responding",
        body: `${who} ${verb} your SOS.${data.note ? ` Note: ${data.note}` : ""}`,
      });
    }
    for (const id of team.clinicianUserIds) {
      rows.push({
        user_id: id,
        patient_id: event.patient_id,
        type: "sos",
        title: `SOS ${verb}`,
        body: `${who} ${verb} an emergency for a patient you support.`,
      });
    }
    await insertNotifications(rows);

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: data.action === "resolve" ? "sos.resolve" : "sos.acknowledge",
      target_type: "sos_event",
      target_id: data.sosId,
      meta: { patient_id: event.patient_id },
    });

    return { ok: true };
  });
