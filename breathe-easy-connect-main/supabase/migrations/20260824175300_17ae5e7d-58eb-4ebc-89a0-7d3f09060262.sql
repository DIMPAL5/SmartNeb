-- 1. Configurable thresholds
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS battery_low_threshold numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS offline_after_minutes integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS bpm_low_warn numeric NOT NULL DEFAULT 55,
  ADD COLUMN IF NOT EXISTS alerts_enabled boolean NOT NULL DEFAULT true;

-- 2. Care plan scheduling
ALTER TABLE public.care_plans
  ADD COLUMN IF NOT EXISTS time_slots text[] NOT NULL DEFAULT '{}';

-- 3. Note editing / deletion
DROP POLICY IF EXISTS "Authoring doctor can update clinical notes" ON public.clinical_notes;
CREATE POLICY "Authoring doctor can update clinical notes"
ON public.clinical_notes FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = clinical_notes.doctor_id AND d.user_id = auth.uid()) OR public.is_staff(auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = clinical_notes.doctor_id AND d.user_id = auth.uid()) OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authoring doctor can delete clinical notes" ON public.clinical_notes;
CREATE POLICY "Authoring doctor can delete clinical notes"
ON public.clinical_notes FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = clinical_notes.doctor_id AND d.user_id = auth.uid()) OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authoring caregiver can update notes" ON public.caregiver_notes;
CREATE POLICY "Authoring caregiver can update notes"
ON public.caregiver_notes FOR UPDATE TO authenticated
USING (author_id = auth.uid() OR public.is_staff(auth.uid()))
WITH CHECK (author_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authoring caregiver can delete notes" ON public.caregiver_notes;
CREATE POLICY "Authoring caregiver can delete notes"
ON public.caregiver_notes FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.is_staff(auth.uid()));

-- 4. Indexes supporting alert de-duplication and audit filtering
CREATE INDEX IF NOT EXISTS idx_alerts_patient_type_status ON public.alerts (patient_id, type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_created ON public.audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_patient_recorded ON public.health_telemetry (patient_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_battery_patient_recorded ON public.battery_telemetry (patient_id, recorded_at DESC);

-- 5. Security: helper functions must not be callable by anonymous visitors
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owns_patient(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_patient(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_patient(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_patient(uuid) TO authenticated, service_role;

-- 6. Background alert evaluation every 5 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('smartneb-alert-engine')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'smartneb-alert-engine');

SELECT cron.schedule(
  'smartneb-alert-engine',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--e177d8e6-70e1-4add-b510-428e671931cf-dev.lovable.app/api/public/cron/evaluate-alerts',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_fzvjEt_A-0boIMjH_DGV-w_DrFTiB6v"}'::jsonb,
    body := '{"source": "pg_cron"}'::jsonb
  );
  $$
);