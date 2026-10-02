import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, BatteryMedium, Cpu, Search, Siren, Wind } from "lucide-react";
import { CaregiverPage } from "@/components/smartneb/caregiver-layout";
import { EmptyState, LoadingSkeleton } from "@/components/smartneb/states";
import { StatusBadge, freshness } from "@/components/smartneb/vitals";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { CaregiverPatientRow } from "@/lib/caregiver.functions";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authenticated/caregiver/patients/")({
  head: () => ({
    meta: [
      { title: "My Patients — SmartNeb Caregiver" },
      {
        name: "description",
        content:
          "Every person assigned to your care with live SpO₂, heart rate, temperature, battery and device status.",
      },
      { property: "og:title", content: "My Patients — SmartNeb Caregiver" },
      {
        property: "og:description",
        content: "Assigned patients with live vitals and device connectivity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyPatientsPage,
});

function statusFor(p: CaregiverPatientRow) {
  if (p.spo2 == null) return "unknown" as const;
  if (p.spo2 < p.spo2_threshold - 3) return "critical" as const;
  if (p.spo2 < p.spo2_threshold) return "warning" as const;
  return "normal" as const;
}

function MyPatientsPage() {
  const t = useT();
  const [q, setQ] = useState("");

  return (
    <CaregiverPage title={t("nav.myPatients")} subtitle={t("caregiver.myPatientsSubtitle")}>
      {({ patients, isLoading }) => (
        <PatientGrid patients={patients} isLoading={isLoading} q={q} setQ={setQ} />
      )}
    </CaregiverPage>
  );
}

function PatientGrid({
  patients,
  isLoading,
  q,
  setQ,
}: {
  patients: CaregiverPatientRow[];
  isLoading: boolean;
  q: string;
  setQ: (v: string) => void;
}) {
  const t = useT();
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? patients.filter(
          (p) =>
            p.full_name.toLowerCase().includes(needle) ||
            p.mrn.toLowerCase().includes(needle) ||
            (p.condition ?? "").toLowerCase().includes(needle),
        )
      : patients;
    return [...list].sort(
      (a, b) => b.activeSOS - a.activeSOS || b.criticalAlerts - a.criticalAlerts || b.activeAlerts - a.activeAlerts,
    );
  }, [patients, q]);

  if (isLoading) return <LoadingSkeleton rows={3} />;

  return (
    <div className="space-y-5">
      <div className="panel flex items-center gap-2 p-3">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("caregiver.searchPatientsPlaceholder")}
          aria-label={t("caregiver.searchAssignedPatients")}
          className="h-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t("caregiver.noAssignedPatients")}
          description={t("caregiver.noAssignedPatientsDescription")}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const fresh = freshness(p.recordedAt);
            return (
              <li key={p.id}>
                <Link
                  to="/caregiver/patients/$patientId"
                  params={{ patientId: p.id }}
                  className="panel block h-full p-5 transition-shadow hover:shadow-glow focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-semibold">{p.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.mrn} · {p.condition ?? t("caregiver.noConditionRecorded")}
                      </p>
                    </div>
                    <StatusBadge status={statusFor(p)} />
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {[
                      [t("vitals.spo2"), p.spo2 == null ? "--" : `${p.spo2}%`],
                      [t("caregiver.heartRate"), p.bpm == null ? "--" : `${p.bpm}`],
                      [t("caregiver.temp"), p.bodyTemperature == null ? "--" : `${p.bodyTemperature.toFixed(1)}°`],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-lg border bg-surface-2 p-2">
                        <dt className="text-[11px] text-muted-foreground">{k}</dt>
                        <dd className="font-display text-lg font-semibold tabular-nums">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Cpu className="size-3.5" aria-hidden /> {p.deviceCode ?? t("caregiver.noDevice")} ·{" "}
                      {p.deviceStatus ?? t("status.unknown")}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <BatteryMedium className="size-3.5" aria-hidden />{" "}
                      {p.fluidLevel == null ? "--" : `${Math.round(p.fluidLevel)}%`} {t("caregiver.chamber")}
                    </span>
                    <span>{t("caregiver.updated", { time: fresh.text })}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.activeSOS > 0 ? (
                      <Badge variant="destructive" className="gap-1">
                        <Siren className="size-3" aria-hidden /> {t("caregiver.sos")}
                      </Badge>
                    ) : null}
                    {p.activeAlerts > 0 ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="size-3" aria-hidden /> {t("caregiver.alertsCount", { count: p.activeAlerts })}
                      </Badge>
                    ) : null}
                    {p.sessionStatus === "running" ? (
                      <Badge variant="secondary" className="gap-1">
                        <Wind className="size-3" aria-hidden /> {t("caregiver.inTherapy")}
                      </Badge>
                    ) : null}
                    {p.planMedication ? (
                      <Badge variant="outline">{p.planMedication}</Badge>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
