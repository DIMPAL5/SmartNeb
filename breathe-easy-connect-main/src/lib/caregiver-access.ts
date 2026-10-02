/** Shared caregiver authorization helpers (no secrets; safe to import anywhere). */

/** Throws unless the signed-in caregiver is assigned to this patient. */
export async function assertAssigned(
  supabase: any,
  userId: string,
  patientId: string,
): Promise<{ caregiverId: string; relation: string | null }> {
  const { data: caregiver } = await supabase
    .from("caregivers")
    .select("id, relation")
    .eq("user_id", userId)
    .maybeSingle();
  if (!caregiver) throw new Error("No caregiver record is linked to this account.");
  const { data: link } = await supabase
    .from("caregiver_patient_assignments")
    .select("id")
    .eq("caregiver_id", caregiver.id)
    .eq("patient_id", patientId)
    .maybeSingle();
  if (!link) throw new Error("You are not assigned to this patient.");
  return { caregiverId: caregiver.id, relation: caregiver.relation ?? null };
}

/** All patient ids assigned to the signed-in caregiver. */
export async function assignedPatientIds(supabase: any, userId: string): Promise<string[]> {
  const { data: caregiver } = await supabase
    .from("caregivers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!caregiver) return [];
  const { data } = await supabase
    .from("caregiver_patient_assignments")
    .select("patient_id")
    .eq("caregiver_id", caregiver.id);
  return (data ?? []).map((r: { patient_id: string }) => r.patient_id);
}
