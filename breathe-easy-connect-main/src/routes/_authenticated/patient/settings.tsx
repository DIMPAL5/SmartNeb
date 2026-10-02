import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getProfile, updateProfile, updateThresholds } from "@/lib/smartneb.functions";
import { PatientPage, useSnapshot } from "@/components/smartneb/patient-layout";
import { LoadingSkeleton } from "@/components/smartneb/states";
import { LanguageSelect } from "@/components/smartneb/language-select";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/patient/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SmartNeb" },
      {
        name: "description",
        content: "Configure alert thresholds, voice warnings and notification preferences for your device.",
      },
      { property: "og:title", content: "Settings — SmartNeb" },
      { property: "og:description", content: "Tune your alert thresholds and notifications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <SettingsRoute />,
});

function SettingsRoute() {
  const t = useT();
  return (
    <PatientPage title={t("nav.settings")} subtitle={t("patient.settings.subtitle")}>
      {({ patientId }) => <SettingsBody patientId={patientId} />}
    </PatientPage>
  );
}

function SettingsBody({ patientId }: { patientId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const snap = useSnapshot(patientId, false);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => getProfile() });

  const [spo2, setSpo2] = useState(92);
  const [bpmHigh, setBpmHigh] = useState(120);
  const [tempMax, setTempMax] = useState(38);
  const [voice, setVoice] = useState(true);
  const [email, setEmail] = useState(true);

  useEffect(() => {
    const p = snap.data?.patient;
    if (p) {
      setSpo2(Number(p.spo2_threshold));
      setBpmHigh(Number(p.bpm_high_threshold));
      setTempMax(Number(p.temp_threshold));
    }
  }, [snap.data?.patient]);

  useEffect(() => {
    if (profile.data) {
      setVoice(profile.data.voice_alerts ?? true);
      setEmail(profile.data.notify_email ?? true);
    }
  }, [profile.data]);

  const saveThresholds = useMutation({
    mutationFn: () => updateThresholds({ data: { patientId, spo2, bpmHigh, tempMax } }),
    onSuccess: () => {
      toast.success(t("patient.settings.thresholdsUpdated"));
      void qc.invalidateQueries({ queryKey: ["snapshot", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePrefs = useMutation({
    mutationFn: () => updateProfile({ data: { voice_alerts: voice, notify_email: email } }),
    onSuccess: () => {
      toast.success(t("patient.settings.preferencesSaved"));
      void qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (snap.isLoading || profile.isLoading) return <LoadingSkeleton rows={3} />;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="panel space-y-6 p-5">
        <p className="font-display text-sm font-semibold">{t("patient.settings.alertThresholds")}</p>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <Label>{t("patient.settings.minSpo2")}</Label>
            <span className="tabular-nums text-muted-foreground">{spo2}%</span>
          </div>
          <Slider value={[spo2]} min={80} max={99} step={1} onValueChange={(v) => setSpo2(v[0] ?? 92)} />
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <Label>{t("patient.settings.maxHeartRate")}</Label>
            <span className="tabular-nums text-muted-foreground">{bpmHigh} bpm</span>
          </div>
          <Slider value={[bpmHigh]} min={80} max={200} step={1} onValueChange={(v) => setBpmHigh(v[0] ?? 120)} />
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <Label>{t("patient.settings.maxBodyTemp")}</Label>
            <span className="tabular-nums text-muted-foreground">{tempMax.toFixed(1)} °C</span>
          </div>
          <Slider
            value={[tempMax]}
            min={36}
            max={42}
            step={0.1}
            onValueChange={(v) => setTempMax(v[0] ?? 38)}
          />
        </div>

        <Button onClick={() => saveThresholds.mutate()} disabled={saveThresholds.isPending}>
          {t("patient.settings.saveThresholds")}
        </Button>
      </section>

      <section className="panel space-y-4 p-5">
        <p className="font-display text-sm font-semibold">{t("language.label")}</p>
        <p className="text-xs text-muted-foreground">{t("language.description")}</p>
        <LanguageSelect className="h-10 w-full max-w-xs" withIcon />
      </section>

      <section className="panel space-y-6 p-5">
        <p className="font-display text-sm font-semibold">{t("notifications.title")}</p>
        <div className="flex items-center justify-between rounded-lg border bg-surface-2 p-4">
          <div>
            <Label htmlFor="voice">{t("patient.settings.spokenAlerts")}</Label>
            <p className="text-xs text-muted-foreground">{t("patient.settings.spokenAlertsDesc")}</p>
          </div>
          <Switch id="voice" checked={voice} onCheckedChange={setVoice} />
        </div>
        <div className="flex items-center justify-between rounded-lg border bg-surface-2 p-4">
          <div>
            <Label htmlFor="email">{t("patient.settings.emailNotifications")}</Label>
            <p className="text-xs text-muted-foreground">{t("patient.settings.emailNotificationsDesc")}</p>
          </div>
          <Switch id="email" checked={email} onCheckedChange={setEmail} />
        </div>
        <Button onClick={() => savePrefs.mutate()} disabled={savePrefs.isPending}>
          {t("patient.settings.savePreferences")}
        </Button>
      </section>
    </div>
  );
}
