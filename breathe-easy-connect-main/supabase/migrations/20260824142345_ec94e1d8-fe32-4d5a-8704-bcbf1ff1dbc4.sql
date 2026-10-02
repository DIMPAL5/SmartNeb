
-- ===== ENUMS =====
CREATE TYPE public.app_role AS ENUM ('patient','doctor','caregiver','admin','super_admin');
CREATE TYPE public.device_status AS ENUM ('online','offline','maintenance','disabled');
CREATE TYPE public.care_plan_status AS ENUM ('draft','published','paused','ended');
CREATE TYPE public.session_status AS ENUM ('pending','starting','running','paused','completed','stopped','failed');
CREATE TYPE public.alert_severity AS ENUM ('critical','warning','info');
CREATE TYPE public.alert_status AS ENUM ('active','acknowledged','resolved');
CREATE TYPE public.adherence_status AS ENUM ('completed','partial','missed','scheduled');
CREATE TYPE public.command_state AS ENUM ('sent','acked','failed');

-- ===== UTILS =====
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ===== PROFILES / ROLES =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  full_name text NOT NULL DEFAULT 'New user',
  phone text,
  avatar_url text,
  theme text NOT NULL DEFAULT 'system',
  voice_alerts boolean NOT NULL DEFAULT true,
  notify_email boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin'));
$$;

CREATE POLICY "profiles readable by self and staff" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "roles readable by self and staff" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- ===== ACTORS =====
CREATE TABLE public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  full_name text NOT NULL,
  specialty text NOT NULL DEFAULT 'Pulmonology',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.caregivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  full_name text NOT NULL,
  relation text NOT NULL DEFAULT 'Family',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  full_name text NOT NULL,
  mrn text NOT NULL UNIQUE,
  date_of_birth date,
  sex text,
  condition text,
  spo2_threshold numeric NOT NULL DEFAULT 92,
  bpm_low_threshold numeric NOT NULL DEFAULT 50,
  bpm_high_threshold numeric NOT NULL DEFAULT 120,
  temp_threshold numeric NOT NULL DEFAULT 38,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TRIGGER patients_updated BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.doctor_patient_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, patient_id)
);
CREATE TABLE public.caregiver_patient_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id uuid NOT NULL REFERENCES public.caregivers(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (caregiver_id, patient_id)
);
CREATE INDEX idx_dpa_patient ON public.doctor_patient_assignments(patient_id);
CREATE INDEX idx_cpa_patient ON public.caregiver_patient_assignments(patient_id);

-- ===== ACCESS HELPER =====
CREATE OR REPLACE FUNCTION public.can_view_patient(_patient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = _patient_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.doctor_patient_assignments a JOIN public.doctors d ON d.id = a.doctor_id
               WHERE a.patient_id = _patient_id AND d.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.caregiver_patient_assignments a JOIN public.caregivers c ON c.id = a.caregiver_id
               WHERE a.patient_id = _patient_id AND c.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.owns_patient(_patient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.patients p WHERE p.id = _patient_id AND p.user_id = auth.uid());
$$;

-- ===== DEVICES =====
CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code text NOT NULL UNIQUE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  status public.device_status NOT NULL DEFAULT 'offline',
  firmware text NOT NULL DEFAULT '1.0.0',
  mqtt_connected boolean NOT NULL DEFAULT false,
  cloud_connected boolean NOT NULL DEFAULT false,
  nebulizer_state text NOT NULL DEFAULT 'OFF',
  fluid_level numeric NOT NULL DEFAULT 100,
  last_seen_at timestamptz,
  registered_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_devices_patient ON public.devices(patient_id);

-- ===== TELEMETRY =====
CREATE TABLE public.health_telemetry (
  id bigserial PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  bpm numeric, spo2 numeric, body_temperature numeric,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_health_pt ON public.health_telemetry(patient_id, recorded_at DESC);

CREATE TABLE public.environmental_telemetry (
  id bigserial PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  ambient_temperature numeric, humidity numeric, aqi numeric, simulated boolean NOT NULL DEFAULT true,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_env_pt ON public.environmental_telemetry(patient_id, recorded_at DESC);

CREATE TABLE public.battery_telemetry (
  id bigserial PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  percentage numeric, voltage numeric, current numeric, power numeric,
  cell_temperature numeric, charging boolean NOT NULL DEFAULT false, fluid_level numeric,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_batt_pt ON public.battery_telemetry(patient_id, recorded_at DESC);

-- ===== CARE PLANS / SESSIONS =====
CREATE TABLE public.care_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  medication text NOT NULL,
  dosage text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 10,
  frequency_per_day integer NOT NULL DEFAULT 2,
  instructions text,
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  status public.care_plan_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_careplans_patient ON public.care_plans(patient_id, status);
CREATE TRIGGER care_plans_updated BEFORE UPDATE ON public.care_plans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.nebulization_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  care_plan_id uuid REFERENCES public.care_plans(id) ON DELETE SET NULL,
  medication text, dosage text,
  prescribed_seconds integer NOT NULL DEFAULT 600,
  elapsed_seconds integer NOT NULL DEFAULT 0,
  status public.session_status NOT NULL DEFAULT 'pending',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_patient ON public.nebulization_sessions(patient_id, started_at DESC);
CREATE TRIGGER sessions_updated BEFORE UPDATE ON public.nebulization_sessions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.adherence_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  care_plan_id uuid REFERENCES public.care_plans(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.nebulization_sessions(id) ON DELETE SET NULL,
  scheduled_for date NOT NULL DEFAULT current_date,
  status public.adherence_status NOT NULL DEFAULT 'scheduled',
  completion_ratio numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_adherence_patient ON public.adherence_records(patient_id, scheduled_for DESC);

CREATE TABLE public.fluid_refills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  level_after numeric NOT NULL DEFAULT 100,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.device_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.devices(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.nebulization_sessions(id) ON DELETE SET NULL,
  command text NOT NULL,
  state public.command_state NOT NULL DEFAULT 'sent',
  issued_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  acked_at timestamptz
);
CREATE INDEX idx_cmd_patient ON public.device_commands(patient_id, created_at DESC);

-- ===== ALERTS / SOS / NOTIFICATIONS =====
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  type text NOT NULL,
  severity public.alert_severity NOT NULL DEFAULT 'warning',
  value numeric, threshold numeric,
  message text NOT NULL,
  status public.alert_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz, acknowledged_by uuid,
  resolved_at timestamptz, resolved_by uuid
);
CREATE INDEX idx_alerts_patient ON public.alerts(patient_id, status, created_at DESC);

CREATE TABLE public.sos_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  vitals jsonb,
  status public.alert_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz, acknowledged_by uuid,
  resolved_at timestamptz, resolved_by uuid
);
CREATE INDEX idx_sos_patient ON public.sos_events(patient_id, created_at DESC);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON public.notifications(user_id, created_at DESC);

CREATE TABLE public.clinical_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER notes_updated BEFORE UPDATE ON public.clinical_notes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  requested_by uuid,
  kind text NOT NULL DEFAULT 'clinical',
  format text NOT NULL DEFAULT 'pdf',
  range_start timestamptz, range_end timestamptz,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_name text,
  action text NOT NULL,
  target_type text, target_id text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);

CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== GRANTS =====
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctors, public.caregivers, public.patients,
  public.doctor_patient_assignments, public.caregiver_patient_assignments, public.devices,
  public.health_telemetry, public.environmental_telemetry, public.battery_telemetry,
  public.care_plans, public.nebulization_sessions, public.adherence_records, public.fluid_refills,
  public.device_commands, public.alerts, public.sos_events, public.notifications,
  public.clinical_notes, public.reports, public.audit_logs, public.ai_conversations, public.ai_messages
  TO authenticated;
GRANT ALL ON public.doctors, public.caregivers, public.patients,
  public.doctor_patient_assignments, public.caregiver_patient_assignments, public.devices,
  public.health_telemetry, public.environmental_telemetry, public.battery_telemetry,
  public.care_plans, public.nebulization_sessions, public.adherence_records, public.fluid_refills,
  public.device_commands, public.alerts, public.sos_events, public.notifications,
  public.clinical_notes, public.reports, public.audit_logs, public.ai_conversations, public.ai_messages
  TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- ===== RLS =====
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caregivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_patient_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caregiver_patient_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environmental_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battery_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nebulization_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fluid_refills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctors read" ON public.doctors FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.doctor_patient_assignments a JOIN public.patients p ON p.id = a.patient_id WHERE a.doctor_id = doctors.id AND p.user_id = auth.uid()));
CREATE POLICY "doctors staff write" ON public.doctors FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "caregivers read" ON public.caregivers FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.caregiver_patient_assignments a JOIN public.patients p ON p.id = a.patient_id WHERE a.caregiver_id = caregivers.id AND p.user_id = auth.uid()));
CREATE POLICY "caregivers staff write" ON public.caregivers FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "patients read" ON public.patients FOR SELECT TO authenticated USING (public.can_view_patient(id));
CREATE POLICY "patients self update" ON public.patients FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid())) WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "patients staff insert" ON public.patients FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "dpa read" ON public.doctor_patient_assignments FOR SELECT TO authenticated USING (public.can_view_patient(patient_id));
CREATE POLICY "dpa staff write" ON public.doctor_patient_assignments FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "cpa read" ON public.caregiver_patient_assignments FOR SELECT TO authenticated USING (public.can_view_patient(patient_id));
CREATE POLICY "cpa staff write" ON public.caregiver_patient_assignments FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "devices read" ON public.devices FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR (patient_id IS NOT NULL AND public.can_view_patient(patient_id)));
CREATE POLICY "devices staff write" ON public.devices FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "health read" ON public.health_telemetry FOR SELECT TO authenticated USING (public.can_view_patient(patient_id));
CREATE POLICY "env read" ON public.environmental_telemetry FOR SELECT TO authenticated USING (public.can_view_patient(patient_id));
CREATE POLICY "batt read" ON public.battery_telemetry FOR SELECT TO authenticated USING (public.can_view_patient(patient_id));

CREATE POLICY "careplans read" ON public.care_plans FOR SELECT TO authenticated USING (public.can_view_patient(patient_id));
CREATE POLICY "careplans doctor write" ON public.care_plans FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = care_plans.doctor_id AND d.user_id = auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = care_plans.doctor_id AND d.user_id = auth.uid()));

CREATE POLICY "sessions read" ON public.nebulization_sessions FOR SELECT TO authenticated USING (public.can_view_patient(patient_id));
CREATE POLICY "sessions patient insert" ON public.nebulization_sessions FOR INSERT TO authenticated WITH CHECK (public.owns_patient(patient_id));
CREATE POLICY "sessions patient update" ON public.nebulization_sessions FOR UPDATE TO authenticated USING (public.owns_patient(patient_id)) WITH CHECK (public.owns_patient(patient_id));

CREATE POLICY "adherence read" ON public.adherence_records FOR SELECT TO authenticated USING (public.can_view_patient(patient_id));
CREATE POLICY "adherence patient write" ON public.adherence_records FOR INSERT TO authenticated WITH CHECK (public.owns_patient(patient_id));
CREATE POLICY "adherence patient update" ON public.adherence_records FOR UPDATE TO authenticated USING (public.owns_patient(patient_id)) WITH CHECK (public.owns_patient(patient_id));

CREATE POLICY "refills read" ON public.fluid_refills FOR SELECT TO authenticated USING (public.can_view_patient(patient_id));
CREATE POLICY "refills patient insert" ON public.fluid_refills FOR INSERT TO authenticated WITH CHECK (public.owns_patient(patient_id));

CREATE POLICY "commands read" ON public.device_commands FOR SELECT TO authenticated USING (public.can_view_patient(patient_id));
CREATE POLICY "commands patient insert" ON public.device_commands FOR INSERT TO authenticated WITH CHECK (public.owns_patient(patient_id));

CREATE POLICY "alerts read" ON public.alerts FOR SELECT TO authenticated USING (public.can_view_patient(patient_id));
CREATE POLICY "alerts insert" ON public.alerts FOR INSERT TO authenticated WITH CHECK (public.can_view_patient(patient_id));
CREATE POLICY "alerts update" ON public.alerts FOR UPDATE TO authenticated USING (public.can_view_patient(patient_id)) WITH CHECK (public.can_view_patient(patient_id));

CREATE POLICY "sos read" ON public.sos_events FOR SELECT TO authenticated USING (public.can_view_patient(patient_id));
CREATE POLICY "sos patient insert" ON public.sos_events FOR INSERT TO authenticated WITH CHECK (public.owns_patient(patient_id));
CREATE POLICY "sos update" ON public.sos_events FOR UPDATE TO authenticated USING (public.can_view_patient(patient_id)) WITH CHECK (public.can_view_patient(patient_id));

CREATE POLICY "notifications own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications own update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "notes doctor read" ON public.clinical_notes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.doctor_patient_assignments a WHERE a.doctor_id = d.id AND a.patient_id = clinical_notes.patient_id)));
CREATE POLICY "notes doctor write" ON public.clinical_notes FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = clinical_notes.doctor_id AND d.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = clinical_notes.doctor_id AND d.user_id = auth.uid()));

CREATE POLICY "reports read" ON public.reports FOR SELECT TO authenticated USING (public.can_view_patient(patient_id));
CREATE POLICY "reports insert" ON public.reports FOR INSERT TO authenticated WITH CHECK (public.can_view_patient(patient_id));

CREATE POLICY "audit read" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR actor_id = auth.uid());
CREATE POLICY "audit insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

CREATE POLICY "ai conv own" ON public.ai_conversations FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai msg own" ON public.ai_messages FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));

-- ===== SIGNUP TRIGGER =====
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role;
  _name text;
  _claimed uuid;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  BEGIN
    _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'patient');
  EXCEPTION WHEN others THEN _role := 'patient';
  END;

  INSERT INTO public.profiles (id, email, full_name) VALUES (NEW.id, NEW.email, _name)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role) ON CONFLICT DO NOTHING;

  IF _role = 'patient' THEN
    SELECT id INTO _claimed FROM public.patients WHERE user_id IS NULL ORDER BY created_at LIMIT 1;
    IF _claimed IS NOT NULL THEN
      UPDATE public.patients SET user_id = NEW.id WHERE id = _claimed;
    ELSE
      INSERT INTO public.patients (user_id, full_name, mrn) VALUES (NEW.id, _name, 'MRN-' || substr(NEW.id::text, 1, 8));
    END IF;
  ELSIF _role = 'doctor' THEN
    SELECT id INTO _claimed FROM public.doctors WHERE user_id IS NULL ORDER BY created_at LIMIT 1;
    IF _claimed IS NOT NULL THEN UPDATE public.doctors SET user_id = NEW.id WHERE id = _claimed;
    ELSE INSERT INTO public.doctors (user_id, full_name) VALUES (NEW.id, _name); END IF;
  ELSIF _role = 'caregiver' THEN
    SELECT id INTO _claimed FROM public.caregivers WHERE user_id IS NULL ORDER BY created_at LIMIT 1;
    IF _claimed IS NOT NULL THEN UPDATE public.caregivers SET user_id = NEW.id WHERE id = _claimed;
    ELSE INSERT INTO public.caregivers (user_id, full_name) VALUES (NEW.id, _name); END IF;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== SEED =====
INSERT INTO public.doctors (id, full_name, specialty) VALUES
  ('11111111-1111-4111-8111-000000000001','Dr. Anitha R','Pulmonology'),
  ('11111111-1111-4111-8111-000000000002','Dr. Vivek S','Respiratory Medicine');
INSERT INTO public.caregivers (id, full_name, relation) VALUES
  ('22222222-2222-4222-8222-000000000001','Meera P','Family'),
  ('22222222-2222-4222-8222-000000000002','Rahul K','Home nurse');
INSERT INTO public.patients (id, full_name, mrn, date_of_birth, sex, condition) VALUES
  ('33333333-3333-4333-8333-000000000001','Dimpal D.','MRN-1001','1996-04-12','F','Moderate persistent asthma'),
  ('33333333-3333-4333-8333-000000000002','Kalpak H S','MRN-1002','1998-09-03','M','COPD - GOLD stage II'),
  ('33333333-3333-4333-8333-000000000003','Chandana G O','MRN-1003','2001-01-22','F','Allergic bronchitis');
INSERT INTO public.doctor_patient_assignments (doctor_id, patient_id) VALUES
  ('11111111-1111-4111-8111-000000000001','33333333-3333-4333-8333-000000000001'),
  ('11111111-1111-4111-8111-000000000001','33333333-3333-4333-8333-000000000002'),
  ('11111111-1111-4111-8111-000000000002','33333333-3333-4333-8333-000000000003');
INSERT INTO public.caregiver_patient_assignments (caregiver_id, patient_id) VALUES
  ('22222222-2222-4222-8222-000000000001','33333333-3333-4333-8333-000000000001'),
  ('22222222-2222-4222-8222-000000000001','33333333-3333-4333-8333-000000000002'),
  ('22222222-2222-4222-8222-000000000002','33333333-3333-4333-8333-000000000003');
INSERT INTO public.devices (id, device_code, patient_id, status, firmware, mqtt_connected, cloud_connected, nebulizer_state, fluid_level, last_seen_at) VALUES
  ('44444444-4444-4444-8444-000000000001','NEB-001','33333333-3333-4333-8333-000000000001','online','2.3.1',true,true,'READY',72,now()),
  ('44444444-4444-4444-8444-000000000002','NEB-002','33333333-3333-4333-8333-000000000002','online','2.3.1',true,true,'READY',41,now()),
  ('44444444-4444-4444-8444-000000000003','NEB-003','33333333-3333-4333-8333-000000000003','offline','2.2.0',false,false,'OFF',88,now() - interval '3 hours');
INSERT INTO public.care_plans (id, patient_id, doctor_id, medication, dosage, duration_minutes, frequency_per_day, instructions, start_date, end_date, status) VALUES
  ('55555555-5555-4555-8555-000000000001','33333333-3333-4333-8333-000000000001','11111111-1111-4111-8111-000000000001','Salbutamol','2.5 mg / 2.5 mL',10,2,'Sit upright. Breathe slowly through the mouthpiece.',current_date - 20, current_date + 40,'published'),
  ('55555555-5555-4555-8555-000000000002','33333333-3333-4333-8333-000000000002','11111111-1111-4111-8111-000000000001','Ipratropium + Salbutamol','0.5 mg / 2.5 mg',12,3,'Rinse mouth after each session.',current_date - 15, current_date + 45,'published'),
  ('55555555-5555-4555-8555-000000000003','33333333-3333-4333-8333-000000000003','11111111-1111-4111-8111-000000000002','Budesonide','0.5 mg / 2 mL',8,2,'Use morning and night.',current_date - 10, current_date + 50,'published');

-- telemetry: last 24h at 10 min intervals
INSERT INTO public.health_telemetry (patient_id, device_id, bpm, spo2, body_temperature, recorded_at)
SELECT d.patient_id, d.id,
  round((72 + 12*sin(extract(epoch from t)/2400.0) + random()*6)::numeric,0),
  round((96 + 2*sin(extract(epoch from t)/3600.0) - (random()*4))::numeric,0),
  round((36.6 + random()*0.9)::numeric,1),
  t
FROM public.devices d
CROSS JOIN generate_series(now() - interval '24 hours', now(), interval '10 minutes') t
WHERE d.patient_id IS NOT NULL;

INSERT INTO public.environmental_telemetry (patient_id, device_id, ambient_temperature, humidity, aqi, recorded_at)
SELECT d.patient_id, d.id,
  round((24 + 4*sin(extract(epoch from t)/7200.0) + random())::numeric,1),
  round((48 + 12*sin(extract(epoch from t)/5400.0) + random()*4)::numeric,0),
  round((55 + 30*random())::numeric,0), t
FROM public.devices d
CROSS JOIN generate_series(now() - interval '24 hours', now(), interval '30 minutes') t
WHERE d.patient_id IS NOT NULL;

INSERT INTO public.battery_telemetry (patient_id, device_id, percentage, voltage, current, power, cell_temperature, charging, fluid_level, recorded_at)
SELECT d.patient_id, d.id,
  greatest(8, round((90 - extract(epoch from (now()-t))/3600.0*1.8 + random()*2)::numeric,0)),
  round((3.7 + random()*0.4)::numeric,2),
  round((0.4 + random()*0.5)::numeric,2),
  round((1.6 + random()*1.2)::numeric,2),
  round((29 + random()*6)::numeric,1),
  false, d.fluid_level, t
FROM public.devices d
CROSS JOIN generate_series(now() - interval '24 hours', now(), interval '15 minutes') t
WHERE d.patient_id IS NOT NULL;

-- sessions + adherence for last 14 days
INSERT INTO public.nebulization_sessions (patient_id, device_id, care_plan_id, medication, dosage, prescribed_seconds, elapsed_seconds, status, started_at, ended_at)
SELECT cp.patient_id, d.id, cp.id, cp.medication, cp.dosage, cp.duration_minutes*60,
  CASE WHEN random() < 0.15 THEN (cp.duration_minutes*60*0.5)::int ELSE cp.duration_minutes*60 END,
  CASE WHEN random() < 0.15 THEN 'stopped'::public.session_status ELSE 'completed'::public.session_status END,
  (current_date - g) + time '08:30', (current_date - g) + time '08:30' + (cp.duration_minutes || ' minutes')::interval
FROM public.care_plans cp
JOIN public.devices d ON d.patient_id = cp.patient_id
CROSS JOIN generate_series(1,14) g
WHERE random() < 0.85;

INSERT INTO public.adherence_records (patient_id, care_plan_id, session_id, scheduled_for, status, completion_ratio)
SELECT s.patient_id, s.care_plan_id, s.id, s.started_at::date,
  CASE WHEN s.status = 'completed' THEN 'completed'::public.adherence_status ELSE 'partial'::public.adherence_status END,
  round((s.elapsed_seconds::numeric / NULLIF(s.prescribed_seconds,0)),2)
FROM public.nebulization_sessions s;

INSERT INTO public.alerts (patient_id, device_id, type, severity, value, threshold, message, status, created_at) VALUES
  ('33333333-3333-4333-8333-000000000002','44444444-4444-4444-8444-000000000002','spo2','critical',89,92,'SpO2 dropped below the configured threshold','active', now() - interval '40 minutes'),
  ('33333333-3333-4333-8333-000000000002','44444444-4444-4444-8444-000000000002','battery','warning',18,20,'Device battery low','active', now() - interval '2 hours'),
  ('33333333-3333-4333-8333-000000000001','44444444-4444-4444-8444-000000000001','fluid','info',22,25,'Medication chamber running low','acknowledged', now() - interval '6 hours'),
  ('33333333-3333-4333-8333-000000000003','44444444-4444-4444-8444-000000000003','device','warning',NULL,NULL,'Device offline for more than 2 hours','active', now() - interval '3 hours');
