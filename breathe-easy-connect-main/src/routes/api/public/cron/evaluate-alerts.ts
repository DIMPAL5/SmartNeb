import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { runAlertEngine } from "@/lib/alert-engine.server";

/**
 * Scheduled alert evaluation endpoint (pg_cron -> pg_net).
 * Authenticated either with the Lovable cron bearer secret or with the
 * project publishable `apikey` header used by the scheduled job.
 */
async function authorize(request: Request): Promise<Response | null> {
  const apiKey = request.headers.get("apikey");
  const expected =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
  if (apiKey && expected && apiKey === expected) return null;
  return authenticateCronRequest(request);
}

async function handle(request: Request) {
  const denied = await authorize(request);
  if (denied) return denied;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const result = await runAlertEngine(supabaseAdmin);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "engine failure" },
      { status: 500 },
    );
  }
}

export const Route = createFileRoute("/api/public/cron/evaluate-alerts")({
  server: {
    handlers: { POST: ({ request }) => handle(request), GET: ({ request }) => handle(request) },
  },
});
