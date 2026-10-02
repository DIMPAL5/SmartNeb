import { createFileRoute, Link } from "@tanstack/react-router";
import { Wind, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — SmartNeb" },
      {
        name: "description",
        content: "SmartNeb Platform Terms of Service and Medical Disclaimer.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wind className="size-4" />
            </span>
            SmartNeb
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 size-4" /> Back to Home
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200 flex items-start gap-3">
          <AlertCircle className="size-5 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <strong className="font-semibold text-amber-300">DRAFT NOTICE:</strong> These Terms of
            Service are a working regulatory draft. Legal review must be completed prior to
            deployment in commercial healthcare environments.
          </div>
        </div>

        <h1 className="font-display text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective Date: October 2026 · Version 1.0 (Draft)
        </p>

        <section className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-destructive-foreground">
            <h2 className="text-base font-bold text-red-400">
              CRITICAL MEDICAL DISCLAIMER — NOT A DIAGNOSTIC TOOL
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-red-200">
              SMARTNEB IS A CLINICAL MONITORING AID AND NEBULIZATION RECORDING PLATFORM. IT IS NOT
              AN AUTOMATED DIAGNOSTIC SYSTEM, MEDICAL DEVICE MONITOR FOR LIFE SUPPORT, OR A
              REPLACEMENT FOR EMERGENCY SERVICES. IN AN ACUTE EMERGENCY, IMMEDIATELY CALL LOCAL
              EMERGENCY DISPATCH (112 / 911 / 999) OR PROCEED TO THE NEAREST EMERGENCY ROOM.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p className="mt-2">
              By registering an account or connecting an ESP32 hardware device to SmartNeb, you
              agree to be bound by these Terms of Service and all incorporated safety notices.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground">
              2. Authorized Use & Eligibility
            </h2>
            <p className="mt-2">
              Patients must be under the care of a licensed pulmonologist, general physician, or
              qualified respiratory therapist. Pediatric use requires explicit parental or legal
              guardian supervision.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground">
              3. Hardware & Network Dependencies
            </h2>
            <p className="mt-2">
              Real-time telemetry and remote start/stop nebulizer commands depend on active Wi-Fi
              and hosted cloud MQTT connectivity. We are not liable for communication delays or
              telemetry packet drops caused by intermittent local networks or power outages.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground">
              4. Role of Artificial Intelligence (Gemini Assistant)
            </h2>
            <p className="mt-2">
              All AI-generated responses within SmartNeb are strictly informational summaries based
              on user telemetry. AI responses must never be construed as clinical diagnosis,
              prescription alterations, or emergency guidance.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground">
              5. Termination & Account Deletion
            </h2>
            <p className="mt-2">
              You may terminate your account at any time via the in-app settings or via our{" "}
              <Link to="/delete-account" className="text-primary underline">
                Account Deletion Page
              </Link>
              .
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
