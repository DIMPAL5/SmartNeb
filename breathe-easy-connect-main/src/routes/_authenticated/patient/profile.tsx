import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getProfile, updateProfile } from "@/lib/smartneb.functions";
import { PatientPage, useSnapshot } from "@/components/smartneb/patient-layout";
import { ErrorState, LoadingSkeleton } from "@/components/smartneb/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authenticated/patient/profile")({
  head: () => ({
    meta: [
      { title: "Profile — SmartNeb" },
      {
        name: "description",
        content:
          "Manage your personal details, emergency contact and linked SmartNeb device information.",
      },
      { property: "og:title", content: "Profile — SmartNeb" },
      { property: "og:description", content: "Your SmartNeb account and device details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ProfileRoute />,
});

function ProfileRoute() {
  const t = useT();
  return (
    <PatientPage title={t("nav.profile")} subtitle={t("patient.profile.subtitle")}>
      {({ patientId }) => <ProfileBody patientId={patientId} />}
    </PatientPage>
  );
}

function ProfileBody({ patientId }: { patientId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => getProfile() });
  const snap = useSnapshot(patientId, false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (profile.data) {
      setFullName(profile.data.full_name ?? "");
      setPhone(profile.data.phone ?? "");
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => updateProfile({ data: { full_name: fullName, phone } }),
    onSuccess: () => {
      toast.success(t("patient.profile.saved"));
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (profile.isLoading) return <LoadingSkeleton rows={3} />;
  if (profile.isError) return <ErrorState message={(profile.error as Error).message} />;

  const patient = snap.data?.patient;
  const device = snap.data?.device;

  const recordRows: Array<[string, string | null | undefined]> = [
    [t("patient.profile.mrn"), patient?.mrn],
    [t("patient.profile.condition"), patient?.condition],
    [t("patient.profile.dob"), patient?.date_of_birth],
    [t("patient.profile.device"), device?.device_code],
    [t("patient.profile.firmware"), device?.firmware],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        className="panel space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <p className="font-display text-sm font-semibold">{t("patient.profile.account")}</p>
        <div className="space-y-2">
          <Label htmlFor="name">{t("patient.profile.fullName")}</Label>
          <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">{t("patient.profile.phone")}</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t("patient.profile.email")}</Label>
          <Input id="email" value={profile.data?.email ?? ""} readOnly disabled />
        </div>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? t("action.saving") : t("patient.profile.saveChanges")}
        </Button>
      </form>

      <section className="panel space-y-4 p-5">
        <p className="font-display text-sm font-semibold">{t("patient.profile.medicalRecord")}</p>
        <dl className="grid gap-3 text-sm">
          {recordRows.map(([k, v]) => (
            <div key={String(k)} className="flex justify-between border-b pb-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v ?? "--"}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">{t("patient.profile.maintainedNote")}</p>
      </section>
    </div>
  );
}
