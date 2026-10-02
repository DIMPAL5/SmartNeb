/**
 * Server-only notification writer.
 *
 * `notifications` intentionally has no INSERT policy: a signed-in user must not
 * be able to fabricate notifications for another account. Every in-app
 * notification is therefore written here with the service-role client, after the
 * calling server function has already authorised the actor.
 */
export type NotificationInsert = {
  user_id: string;
  patient_id?: string | null;
  type: string;
  title: string;
  body?: string | null;
};

export async function insertNotifications(rows: NotificationInsert[]) {
  const clean = rows.filter((r) => Boolean(r.user_id));
  if (!clean.length) return 0;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("notifications").insert(
    clean.map((r) => ({
      user_id: r.user_id,
      patient_id: r.patient_id ?? null,
      type: r.type,
      title: r.title,
      body: r.body ?? null,
    })),
  );
  if (error) throw new Error(error.message);
  return clean.length;
}

/** Resolves the auth user ids of a patient's care team (patient + doctors + caregivers). */
export async function careTeamUserIds(patientId: string, exclude: string[] = []) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [patient, doctorLinks, caregiverLinks] = await Promise.all([
    supabaseAdmin.from("patients").select("user_id").eq("id", patientId).maybeSingle(),
    supabaseAdmin.from("doctor_patient_assignments").select("doctor_id").eq("patient_id", patientId),
    supabaseAdmin
      .from("caregiver_patient_assignments")
      .select("caregiver_id")
      .eq("patient_id", patientId),
  ]);

  const doctorIds = (doctorLinks.data ?? []).map((r) => r.doctor_id);
  const caregiverIds = (caregiverLinks.data ?? []).map((r) => r.caregiver_id);

  const [doctors, caregivers] = await Promise.all([
    doctorIds.length
      ? supabaseAdmin.from("doctors").select("user_id").in("id", doctorIds)
      : Promise.resolve({ data: [] as { user_id: string | null }[] }),
    caregiverIds.length
      ? supabaseAdmin.from("caregivers").select("user_id").in("id", caregiverIds)
      : Promise.resolve({ data: [] as { user_id: string | null }[] }),
  ]);

  const ids = new Set<string>();
  if (patient.data?.user_id) ids.add(patient.data.user_id);
  for (const d of doctors.data ?? []) if (d.user_id) ids.add(d.user_id);
  for (const c of caregivers.data ?? []) if (c.user_id) ids.add(c.user_id);
  for (const e of exclude) ids.delete(e);

  return {
    all: [...ids],
    patientUserId: patient.data?.user_id ?? null,
    clinicianUserIds: [...ids].filter((id) => id !== patient.data?.user_id),
  };
}
