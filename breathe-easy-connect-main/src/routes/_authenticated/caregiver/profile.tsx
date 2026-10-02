import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getProfile, updateProfile } from "@/lib/smartneb.functions";
import { CaregiverPage } from "@/components/smartneb/caregiver-layout";
import { useSignedIn } from "@/components/smartneb/use-signed-in";
import { LoadingSkeleton } from "@/components/smartneb/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authenticated/caregiver/profile")({
  head: () => ({
    meta: [
      { title: "Caregiver Profile — SmartNeb" },
      {
        name: "description",
        content:
          "Manage your caregiver contact details, notification preferences and voice alerts.",
      },
      { property: "og:title", content: "Caregiver Profile — SmartNeb" },
      {
        property: "og:description",
        content: "Contact details and alert preferences for caregivers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CaregiverProfilePage,
});

function CaregiverProfilePage() {
  const t = useT();
  const signedIn = useSignedIn() === true;
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfile(),
    enabled: signedIn,
    retry: false,
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [voice, setVoice] = useState(true);
  const [emailNotify, setEmailNotify] = useState(true);

  useEffect(() => {
    if (!profile.data) return;
    setFullName(profile.data.full_name ?? "");
    setPhone(profile.data.phone ?? "");
    setVoice(profile.data.voice_alerts !== false);
    setEmailNotify(profile.data.notify_email !== false);
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () =>
      updateProfile({
        data: { full_name: fullName, phone, voice_alerts: voice, notify_email: emailNotify },
      }),
    onSuccess: () => {
      toast.success(t("caregiver.profileUpdated"));
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <CaregiverPage title={t("nav.profile")} subtitle={t("caregiver.profileSubtitle")}>
      {({ patients }) =>
        profile.isPending ? (
          <LoadingSkeleton rows={2} />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <form
              className="panel space-y-4 p-6"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="full_name">{t("caregiver.fullName")}</Label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("caregiver.contactPhone")}</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("caregiver.contactPhonePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("caregiver.email")}</Label>
                <Input id="email" value={profile.data?.email ?? ""} disabled />
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-surface-2 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{t("caregiver.spokenCriticalAlerts")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("caregiver.spokenCriticalAlertsDescription")}
                  </p>
                </div>
                <Switch
                  checked={voice}
                  onCheckedChange={setVoice}
                  aria-label={t("caregiver.spokenCriticalAlerts")}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-surface-2 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{t("caregiver.emailNotifications")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("caregiver.emailNotificationsDescription")}
                  </p>
                </div>
                <Switch
                  checked={emailNotify}
                  onCheckedChange={setEmailNotify}
                  aria-label={t("caregiver.emailNotifications")}
                />
              </div>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? t("action.saving") : t("caregiver.saveChanges")}
              </Button>
            </form>

            <section className="panel space-y-3 p-6">
              <h2 className="font-display text-sm font-semibold">
                {t("caregiver.careAssignments")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("caregiver.careAssignmentsDescription")}
              </p>
              {patients.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("caregiver.noPatientsAssignedYet")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {patients.map((p) => (
                    <li key={p.id} className="rounded-lg border bg-surface-2 px-3 py-2 text-sm">
                      <span className="font-medium">{p.full_name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {p.mrn}
                        {p.relation ? ` · ${p.relation}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )
      }
    </CaregiverPage>
  );
}
