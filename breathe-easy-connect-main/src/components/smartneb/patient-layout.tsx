import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMe, getPatientSnapshot } from "@/lib/smartneb.functions";
import { AppShell, patientNav } from "./app-shell";
import { useSignedIn } from "./use-signed-in";
import { ErrorState, LoadingSkeleton } from "./states";
import { useT } from "@/i18n";

export function useMe() {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: ["me"],
    queryFn: () => getMe(),
    staleTime: 60_000,
    enabled: signedIn === true,
    retry: false,
  });
}

export function useSnapshot(patientId: string | null | undefined, live = true) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: ["snapshot", patientId],
    queryFn: () => getPatientSnapshot({ data: { patientId: patientId! } }),
    enabled: Boolean(patientId) && signedIn === true,
    refetchInterval: live ? 5_000 : false,
    retry: false,
  });
}

export function PatientPage({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: (ctx: { patientId: string; fullName: string }) => ReactNode;
}) {
  const t = useT();
  const me = useMe();

  if (me.isPending) {
    return (
      <div className="p-8">
        <LoadingSkeleton rows={4} />
      </div>
    );
  }
  if (me.isError) {
    return (
      <div className="p-8">
        <ErrorState message={(me.error as Error)?.message} onRetry={() => me.refetch()} />
      </div>
    );
  }

  return (
    <AppShell me={me.data} nav={patientNav} title={title} subtitle={subtitle} actions={actions}>
      {me.data.patientId ? (
        children({ patientId: me.data.patientId, fullName: me.data.fullName })
      ) : (
        <ErrorState message={t("patient.noRecordLinked")} />
      )}
    </AppShell>
  );
}

export function greetingKey(): "patient.greeting.morning" | "patient.greeting.afternoon" | "patient.greeting.evening" {
  const h = new Date().getHours();
  if (h < 12) return "patient.greeting.morning";
  if (h < 17) return "patient.greeting.afternoon";
  return "patient.greeting.evening";
}

export { useSignedIn };
