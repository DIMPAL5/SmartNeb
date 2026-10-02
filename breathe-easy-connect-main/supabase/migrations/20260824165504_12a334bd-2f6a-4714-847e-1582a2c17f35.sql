CREATE TABLE public.caregiver_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  caregiver_id uuid REFERENCES public.caregivers(id) ON DELETE SET NULL,
  author_id uuid,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.caregiver_notes TO authenticated;
GRANT ALL ON public.caregiver_notes TO service_role;

ALTER TABLE public.caregiver_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "care team can read caregiver notes"
ON public.caregiver_notes FOR SELECT TO authenticated
USING (public.can_view_patient(patient_id));

CREATE POLICY "caregivers insert own notes"
ON public.caregiver_notes FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.caregiver_patient_assignments a
    JOIN public.caregivers c ON c.id = a.caregiver_id
    WHERE a.patient_id = caregiver_notes.patient_id AND c.user_id = auth.uid()
  )
);

CREATE POLICY "caregivers update own notes"
ON public.caregiver_notes FOR UPDATE TO authenticated
USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

CREATE POLICY "caregivers delete own notes"
ON public.caregiver_notes FOR DELETE TO authenticated
USING (author_id = auth.uid());

CREATE TRIGGER caregiver_notes_updated
BEFORE UPDATE ON public.caregiver_notes
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX caregiver_notes_patient_idx ON public.caregiver_notes(patient_id, created_at DESC);