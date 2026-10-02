import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getProfile, updateProfile } from "@/lib/smartneb.functions";
import { DoctorPage } from "@/components/smartneb/doctor-layout";
import { LoadingSkeleton } from "@/components/smartneb/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authenticated/doctor/profile")({
  head: () => ({
    meta: [
      { title: "Clinician Profile — SmartNeb" },
      {
        name: "description",
        content: "Manage your SmartNeb clinician identity, contact details and patient panel size.",
      },
      { property: "og:title", content: "Clinician Profile — SmartNeb" },
      {
        property: "og:description",
        content: "Update the contact details your care team and patients see.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DoctorProfilePage,
});

function DoctorProfilePage() {
  const t = useT();
  return (
    <DoctorPage title={t("doctor.profile.title")} subtitle={t("doctor.profile.subtitle")}>
      {({ patients, signedIn }) => {
        const qc = useQueryClient();
        const profile = useQuery({
          queryKey: ["profile"],
          queryFn: () => getProfile(),
          enabled: signedIn,
          retry: false,
        });
        const [fullName, setFullName] = useState("");
        const [phone, setPhone] = useState("");

        useEffect(() => {
          if (profile.data) {
            setFullName(profile.data.full_name ?? "");
            setPhone(profile.data.phone ?? "");
          }
        }, [profile.data]);

        const save = useMutation({
          mutationFn: () =>
            updateProfile({ data: { full_name: fullName.trim(), phone: phone.trim() } }),
          onSuccess: () => {
            toast.success(t("doctor.profile.updated"));
            void qc.invalidateQueries({ queryKey: ["profile"] });
            void qc.invalidateQueries({ queryKey: ["me"] });
          },
          onError: (e: Error) => toast.error(e.message),
        });

        if (profile.isPending) return <LoadingSkeleton rows={3} />;

        return (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <form
              className="panel space-y-4 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (fullName.trim().length < 2) {
                  toast.error(t("doctor.validation.enterFullName"));
                  return;
                }
                save.mutate();
              }}
            >
              <h2 className="font-display text-sm font-semibold">
                {t("doctor.profile.contactDetails")}
              </h2>
              <div className="space-y-1.5">
                <Label htmlFor="full-name">{t("doctor.profile.fullName")}</Label>
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">{t("doctor.profile.phone")}</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 ..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("doctor.profile.email")}</Label>
                <Input id="email" value={profile.data?.email ?? ""} readOnly disabled />
              </div>
              <Button type="submit" disabled={save.isPending}>
                {t("doctor.profile.saveProfile")}
              </Button>
            </form>

            <aside className="panel space-y-3 p-5">
              <h2 className="font-display text-sm font-semibold">
                {t("doctor.profile.practiceSummary")}
              </h2>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("doctor.profile.assignedPatients")}
                </span>
                <span className="font-display text-lg font-semibold tabular-nums">
                  {patients.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("doctor.profile.activeAlerts")}</span>
                <span className="font-display text-lg font-semibold tabular-nums">
                  {patients.reduce((n, p) => n + p.activeAlerts, 0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("doctor.profile.inTherapyNow")}</span>
                <span className="font-display text-lg font-semibold tabular-nums">
                  {patients.filter((p) => p.sessionStatus === "running").length}
                </span>
              </div>
              <Badge variant="secondary">{t("doctor.profile.clinicianAccount")}</Badge>
              <p className="text-xs text-muted-foreground">
                {t("doctor.profile.assignmentsManaged")}
              </p>
            </aside>
          </div>
        );
      }}
    </DoctorPage>
  );
}
