import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Manual entry point into the server-side alert engine.
 * The scheduled job (pg_cron every 5 min) is the primary trigger; this lets a
 * patient's own device page, or staff, force an immediate evaluation.
 */
export const evaluateAlertsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId?: string }) =>
    z.object({ patientId: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let scope: string[] | undefined;
    if (data.patientId) {
      const { data: allowed } = await supabase.rpc("can_view_patient", {
        _patient_id: data.patientId,
      });
      if (!allowed) throw new Error("Not authorized for this patient.");
      scope = [data.patientId];
    } else {
      const { data: staff } = await supabase.rpc("is_staff", { _user_id: userId });
      if (!staff) throw new Error("Administrator access required for a full sweep.");
    }

    const [{ runAlertEngine }, { supabaseAdmin }] = await Promise.all([
      import("@/lib/alert-engine.server"),
      import("@/integrations/supabase/client.server"),
    ]);
    return runAlertEngine(supabaseAdmin, scope);
  });

/** Patient/clinician-configurable alert thresholds. */
export const updateAlertThresholds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      patientId: string;
      spo2?: number;
      bpmLow?: number;
      bpmHigh?: number;
      tempMax?: number;
      batteryLow?: number;
      offlineMinutes?: number;
      alertsEnabled?: boolean;
    }) =>
      z
        .object({
          patientId: z.string().uuid(),
          spo2: z.number().min(80).max(99).optional(),
          bpmLow: z.number().min(30).max(80).optional(),
          bpmHigh: z.number().min(80).max(200).optional(),
          tempMax: z.number().min(36).max(42).optional(),
          batteryLow: z.number().min(5).max(60).optional(),
          offlineMinutes: z.number().int().min(5).max(720).optional(),
          alertsEnabled: z.boolean().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {};
    if (data.spo2 !== undefined) patch["spo2_threshold"] = data.spo2;
    if (data.bpmLow !== undefined) patch["bpm_low_threshold"] = data.bpmLow;
    if (data.bpmHigh !== undefined) patch["bpm_high_threshold"] = data.bpmHigh;
    if (data.tempMax !== undefined) patch["temp_threshold"] = data.tempMax;
    if (data.batteryLow !== undefined) patch["battery_low_threshold"] = data.batteryLow;
    if (data.offlineMinutes !== undefined) patch["offline_after_minutes"] = data.offlineMinutes;
    if (data.alertsEnabled !== undefined) patch["alerts_enabled"] = data.alertsEnabled;
    if (!Object.keys(patch).length) return { ok: true };

    const { error } = await supabase
      .from("patients")
      .update(patch as any)
      .eq("id", data.patientId);
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "alert.thresholds.update",
      target_type: "patient",
      target_id: data.patientId,
      meta: patch as any,
    });
    return { ok: true };
  });

export const getAlertThresholds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patientId: string }) => z.object({ patientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("patients")
      .select(
        "spo2_threshold, bpm_low_threshold, bpm_high_threshold, temp_threshold, battery_low_threshold, offline_after_minutes, alerts_enabled",
      )
      .eq("id", data.patientId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });
