import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Droplets } from "lucide-react";
import { toast } from "sonner";
import { listRefills, refillChamber } from "@/lib/smartneb.functions";
import { PatientPage, useSnapshot } from "@/components/smartneb/patient-layout";
import { NebulizerControl } from "@/components/smartneb/nebulizer-control";
import { useDeviceTelemetry } from "@/hooks/use-device-telemetry";
import { Gauge, StatusBadge } from "@/components/smartneb/vitals";
import { ErrorState, LoadingSkeleton } from "@/components/smartneb/states";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authenticated/patient/nebulizer")({
  head: () => ({
    meta: [
      { title: "My Nebulizer — SmartNeb" },
      {
        name: "description",
        content:
          "Control your connected nebulizer, track chamber fluid level and log medication refills.",
      },
      { property: "og:title", content: "My Nebulizer — SmartNeb" },
      {
        property: "og:description",
        content: "Start, pause and monitor your nebulization therapy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <NebulizerRoute />,
});

function NebulizerRoute() {
  const t = useT();
  return (
    <PatientPage title={t("nav.myNebulizer")} subtitle={t("patient.nebulizer.subtitle")}>
      {({ patientId }) => <NebulizerBody patientId={patientId} />}
    </PatientPage>
  );
}

function NebulizerBody({ patientId }: { patientId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const snap = useSnapshot(patientId);
  const dev = useDeviceTelemetry({
    patientId,
    mrn: snap.data?.patient?.mrn ?? null,
    deviceCode: snap.data?.device?.device_code ?? null,
  });
  const refills = useQuery({
    queryKey: ["refills", patientId],
    queryFn: () => listRefills({ data: { patientId } }),
  });
  const [level, setLevel] = useState(100);

  const refill = useMutation({
    mutationFn: () => refillChamber({ data: { patientId, levelAfter: level } }),
    onSuccess: () => {
      toast.success(t("patient.nebulizer.refillLogged"));
      void qc.invalidateQueries({ queryKey: ["refills", patientId] });
      void qc.invalidateQueries({ queryKey: ["snapshot", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (snap.isLoading) return <LoadingSkeleton rows={3} />;
  if (snap.isError || !snap.data)
    return <ErrorState message={(snap.error as Error)?.message} onRetry={() => snap.refetch()} />;

  const { device, carePlan, activeSession } = snap.data;
  const fluid = Number(device?.fluid_level ?? 0);

  const carePlanRows: Array<[string, string | null | undefined]> = [
    [t("patient.nebulizer.medication"), carePlan?.medication],
    [t("patient.nebulizer.dosage"), carePlan?.dosage],
    [t("patient.nebulizer.duration"), carePlan ? `${carePlan.duration_minutes} min` : null],
    [
      t("patient.nebulizer.frequency"),
      carePlan ? t("patient.nebulizer.perDay", { count: carePlan.frequency_per_day }) : null,
    ],
    [
      t("patient.nebulizer.scheduledTimes"),
      (carePlan as { time_slots?: string[] | null } | undefined)?.time_slots?.length
        ? (carePlan as { time_slots?: string[] }).time_slots!.join(" · ")
        : t("patient.nebulizer.flexible"),
    ],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <NebulizerControl
          patientId={patientId}
          session={activeSession}
          deviceOnline={dev.telemetry.online}
          onRelay={dev.setRelay}
          medication={carePlan?.medication ?? null}
          dosage={carePlan?.dosage ?? null}
          prescribedMinutes={carePlan?.duration_minutes ?? 10}
        />

        <section className="panel space-y-4 p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-semibold">
              {t("patient.nebulizer.prescription")}
            </p>
            <StatusBadge
              status={carePlan ? "normal" : "warning"}
              label={carePlan ? t("patient.nebulizer.activePlan") : t("patient.nebulizer.noPlan")}
            />
          </div>
          {carePlan ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              {carePlanRows.map(([k, v]) => (
                <div key={String(k)} className="rounded-lg border bg-surface-2 p-4">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="mt-1 text-sm font-medium">{v ?? "--"}</dd>
                </div>
              ))}
              {carePlan.instructions ? (
                <div className="rounded-lg border bg-surface-2 p-4 sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">
                    {t("patient.nebulizer.instructions")}
                  </dt>
                  <dd className="mt-1 text-sm">{carePlan.instructions}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">{t("patient.nebulizer.noCarePlan")}</p>
          )}
        </section>
      </div>

      <div className="space-y-6">
        <section className="panel flex flex-col items-center gap-4 p-5">
          <p className="self-start font-display text-sm font-semibold">
            {t("patient.nebulizer.chamber")}
          </p>
          <Gauge value={fluid} label={t("patient.nebulizer.fluidLevel")} unit="%" />
          <div className="w-full space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("patient.nebulizer.refillTo")}</span>
              <span className="tabular-nums">{level}%</span>
            </div>
            <Slider
              value={[level]}
              min={0}
              max={100}
              step={5}
              onValueChange={(v) => setLevel(v[0] ?? 0)}
            />
            <Button className="w-full" onClick={() => refill.mutate()} disabled={refill.isPending}>
              <Droplets className="mr-2 size-4" /> {t("patient.nebulizer.logRefill")}
            </Button>
          </div>
        </section>

        <section className="panel p-5">
          <p className="mb-3 font-display text-sm font-semibold">
            {t("patient.nebulizer.recentRefills")}
          </p>
          {refills.data && refills.data.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {refills.data.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border bg-surface-2 px-3 py-2"
                >
                  <span className="text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                  <span className="tabular-nums">{Number(r.level_after)}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("patient.nebulizer.noRefills")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
