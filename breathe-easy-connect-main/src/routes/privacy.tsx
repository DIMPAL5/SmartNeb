import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Wind, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — SmartNeb" },
      {
        name: "description",
        content: "SmartNeb Privacy Policy and Health Data Protection Governance.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
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
            <strong className="font-semibold text-amber-300">DRAFT NOTICE:</strong> This Privacy
            Policy is a comprehensive working draft prepared for regulatory review. It must undergo
            formal legal qualification prior to clinical commercial release.
          </div>
        </div>

        <h1 className="font-display text-3xl font-bold tracking-tight">
          Privacy Policy & Health Data Governance
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective Date: October 2026 · Version 1.0 (Draft)
        </p>

        <section className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
          <div>
            <h2 className="text-lg font-semibold text-foreground">1. Introduction & Overview</h2>
            <p className="mt-2">
              SmartNeb (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to
              protecting your privacy and ensuring the security of your protected health information
              (PHI) and personal data. This Privacy Policy details our practices concerning data
              collection, transmission, processing, storage, and rights across the SmartNeb IoT
              platform, mobile application, and web console.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground">
              2. Categories of Data Collected
            </h2>
            <p className="mt-2">
              We collect the following explicit data categories necessary to provide respiratory
              therapy monitoring:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>
                <strong>Health & Vitals Data:</strong> Real-time SpO₂ (blood oxygen saturation),
                pulse rate (BPM), body temperature, nebulizer elapsed session times, and medication
                adherence records.
              </li>
              <li>
                <strong>Environmental Telemetry:</strong> Ambient temperature, relative humidity,
                and simulated particulate air quality index (AQI) transmitted from device sensors.
              </li>
              <li>
                <strong>Account Identifiers:</strong> Full name, verified email address, hashed
                authentication credentials, role (Patient, Clinician, Caregiver, Hospital Admin),
                and hospital tenant identifier.
              </li>
              <li>
                <strong>Hardware & Device Identifiers:</strong> ESP32 device MAC address, device
                UUID, firmware version, and battery health telemetry.
              </li>
              <li>
                <strong>Diagnostic & Safety Logs:</strong> Network request timestamps, error stacks,
                and system audit logs. We do NOT collect GPS location, contacts, or multimedia
                audio/camera recordings.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground">
              3. Purpose and Legal Basis for Processing
            </h2>
            <p className="mt-2">
              We process data strictly to deliver remote nebulizer therapy monitoring, trigger
              critical threshold alerts (such as hypoxic SpO₂ drops), synchronize clinical care
              plans, and maintain regulatory compliance under applicable healthcare frameworks
              including India DPDP Act 2023, US HIPAA, and EU GDPR.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground">
              4. Encryption in Transit & At Rest
            </h2>
            <p className="mt-2">
              All data transmitted between the ESP32 hardware, backend servers, mobile applications,
              and web consoles is encrypted using Transport Layer Security (TLS 1.3 / TLS 1.2
              minimum) via HTTPS and MQTTS (port 8883). Persistent databases utilize AES-256
              encryption at rest.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground">
              5. Children & Minor Protection
            </h2>
            <p className="mt-2">
              When SmartNeb is utilized by pediatric patients under 18 years of age, verified
              verifiable parental/guardian consent is mandatory prior to health data ingestion, in
              compliance with Section 9 of the India DPDP Act and COPPA.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground">
              6. Data Retention & Account Deletion
            </h2>
            <p className="mt-2">
              Users maintain the right to withdraw consent and request total deletion of their
              account and personal health data. You may initiate deletion in-app or via our public{" "}
              <Link to="/delete-account" className="text-primary underline">
                Account Deletion Portal
              </Link>
              . Data deletion is executed within 30 days, subject only to mandatory clinical audit
              retention laws.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground">
              7. Contact & Data Protection Officer
            </h2>
            <p className="mt-2">
              For privacy inquiries, audit requests, or regulatory filings, contact our Data
              Protection Officer at:{" "}
              <code className="text-foreground">privacy@smartneb.health</code>.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
