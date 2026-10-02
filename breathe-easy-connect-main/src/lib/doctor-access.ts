/** Shared doctor authorization helpers (no secrets; safe to import anywhere). */

/** The doctors.id row linked to the signed-in user, or null. */
export async function resolveDoctorId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.from("doctors").select("id").eq("user_id", userId).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** All patient ids assigned to the signed-in doctor. */
export async function doctorPatientIds(supabase: any, userId: string): Promise<string[]> {
  const doctorId = await resolveDoctorId(supabase, userId);
  if (!doctorId) return [];
  const { data } = await supabase
    .from("doctor_patient_assignments")
    .select("patient_id")
    .eq("doctor_id", doctorId);
  return (data ?? []).map((r: { patient_id: string }) => r.patient_id);
}

/** Throws unless the signed-in doctor is assigned to this patient. */
export async function assertDoctorAssigned(
  supabase: any,
  userId: string,
  patientId: string,
): Promise<{ doctorId: string }> {
  const doctorId = await resolveDoctorId(supabase, userId);
  if (!doctorId) throw new Error("No clinician record is linked to this account.");
  const { data: link } = await supabase
    .from("doctor_patient_assignments")
    .select("id")
    .eq("doctor_id", doctorId)
    .eq("patient_id", patientId)
    .maybeSingle();
  if (!link) throw new Error("You are not assigned to this patient.");
  return { doctorId };
}
