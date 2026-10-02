import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Note editing / deletion for clinicians and caregivers.
 * RLS enforces authorship; these functions add validation + audit trail.
 */

const idNote = z.object({ id: z.string().uuid(), note: z.string().trim().min(2).max(4000) });
const idOnly = z.object({ id: z.string().uuid() });

async function audit(
  context: any,
  action: string,
  targetType: string,
  targetId: string,
  meta: Record<string, unknown> = {},
) {
  await context.supabase.from("audit_logs").insert({
    actor_id: context.userId,
    action,
    target_type: targetType,
    target_id: targetId,
    meta,
  });
}

export const updateClinicalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; note: string }) => idNote.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("clinical_notes")
      .update({ note: data.note })
      .eq("id", data.id)
      .select("id, patient_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("You can only edit clinical notes you authored.");
    await audit(context, "note.clinical.update", "clinical_note", data.id, {
      patient_id: row.patient_id,
    });
    return { ok: true };
  });

export const deleteClinicalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => idOnly.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("clinical_notes")
      .delete()
      .eq("id", data.id)
      .select("id, patient_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("You can only delete clinical notes you authored.");
    await audit(context, "note.clinical.delete", "clinical_note", data.id, {
      patient_id: row.patient_id,
    });
    return { ok: true };
  });

export const updateCaregiverNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; note: string }) => idNote.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("caregiver_notes")
      .update({ note: data.note })
      .eq("id", data.id)
      .select("id, patient_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("You can only edit caregiver notes you authored.");
    await audit(context, "note.caregiver.update", "caregiver_note", data.id, {
      patient_id: row.patient_id,
    });
    return { ok: true };
  });

export const deleteCaregiverNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => idOnly.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("caregiver_notes")
      .delete()
      .eq("id", data.id)
      .select("id, patient_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("You can only delete caregiver notes you authored.");
    await audit(context, "note.caregiver.delete", "caregiver_note", data.id, {
      patient_id: row.patient_id,
    });
    return { ok: true };
  });
