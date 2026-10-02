ALTER TABLE public.health_telemetry REPLICA IDENTITY FULL;
ALTER TABLE public.alerts REPLICA IDENTITY FULL;
ALTER TABLE public.nebulization_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.sos_events REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='health_telemetry') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.health_telemetry;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='alerts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='nebulization_sessions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.nebulization_sessions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='sos_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_events;
  END IF;
END $$;