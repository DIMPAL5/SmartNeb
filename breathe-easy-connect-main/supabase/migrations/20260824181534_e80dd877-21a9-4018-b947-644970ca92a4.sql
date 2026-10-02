ALTER TABLE public.health_telemetry ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'device';
ALTER TABLE public.battery_telemetry ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'device';
ALTER TABLE public.environmental_telemetry ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'device';
CREATE INDEX IF NOT EXISTS health_telemetry_source_idx ON public.health_telemetry (source);
CREATE INDEX IF NOT EXISTS battery_telemetry_source_idx ON public.battery_telemetry (source);
CREATE INDEX IF NOT EXISTS environmental_telemetry_source_idx ON public.environmental_telemetry (source);