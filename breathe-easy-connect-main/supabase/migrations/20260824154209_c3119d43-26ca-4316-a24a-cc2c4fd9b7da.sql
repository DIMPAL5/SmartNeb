CREATE OR REPLACE FUNCTION public.trigger_patient_sos(
  _patient_id uuid,
  _source text DEFAULT 'manual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sos public.sos_events%ROWTYPE;
  _vitals jsonb;
  _device public.devices%ROWTYPE;
  _patient_name text;
  _recipients uuid[];
  _notified integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.owns_patient(_patient_id) THEN
    RAISE EXCEPTION 'Only the patient can trigger their own SOS.' USING ERRCODE = '42501';
  END IF;

  IF _source NOT IN ('manual', 'voice', 'api') THEN
    RAISE EXCEPTION 'Invalid SOS source.' USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object(
    'bpm', h.bpm,
    'spo2', h.spo2,
    'body_temperature', h.body_temperature,
    'recorded_at', h.recorded_at
  )
  INTO _vitals
  FROM public.health_telemetry h
  WHERE h.patient_id = _patient_id
  ORDER BY h.recorded_at DESC
  LIMIT 1;

  SELECT * INTO _device
  FROM public.devices d
  WHERE d.patient_id = _patient_id
  ORDER BY d.last_seen_at DESC NULLS LAST, d.registered_at DESC
  LIMIT 1;

  SELECT p.full_name INTO _patient_name
  FROM public.patients p
  WHERE p.id = _patient_id;

  INSERT INTO public.sos_events (patient_id, source, vitals)
  VALUES (_patient_id, _source, _vitals)
  RETURNING * INTO _sos;

  SELECT COALESCE(array_agg(DISTINCT recipient_id), ARRAY[]::uuid[])
  INTO _recipients
  FROM (
    SELECT d.user_id AS recipient_id
    FROM public.doctor_patient_assignments a
    JOIN public.doctors d ON d.id = a.doctor_id
    WHERE a.patient_id = _patient_id AND d.user_id IS NOT NULL
    UNION
    SELECT c.user_id AS recipient_id
    FROM public.caregiver_patient_assignments a
    JOIN public.caregivers c ON c.id = a.caregiver_id
    WHERE a.patient_id = _patient_id AND c.user_id IS NOT NULL
  ) assigned_team;

  INSERT INTO public.notifications (user_id, patient_id, type, title, body)
  SELECT
    recipient_id,
    _patient_id,
    'sos',
    'Emergency SOS: ' || COALESCE(_patient_name, 'Patient'),
    'SpO2 ' || COALESCE(_vitals->>'spo2', '--') || '% · HR ' ||
      COALESCE(_vitals->>'bpm', '--') || ' bpm · Device ' ||
      COALESCE(_device.device_code, 'unassigned') || ' (' ||
      COALESCE(_device.status::text, 'unknown') || ')'
  FROM unnest(_recipients) AS recipient_id;

  GET DIAGNOSTICS _notified = ROW_COUNT;

  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, meta)
  VALUES (
    auth.uid(),
    'sos.trigger',
    'sos_event',
    _sos.id::text,
    jsonb_build_object('patient_id', _patient_id, 'notified', _notified)
  );

  RETURN jsonb_build_object(
    'sos', to_jsonb(_sos),
    'notified', _notified
  );
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_patient_sos(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trigger_patient_sos(uuid, text) TO authenticated;