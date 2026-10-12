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
    queryFn: async () => {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("smartneb_user");
        if (stored) {
          try {
            const u = JSON.parse(stored);
            if (u && u.role) {
              return {
                userId: u.userId || u.id,
                email: u.email || "",
                fullName: u.fullName || u.full_name || "User",
                role: u.role,
                patientId: u.patientId || null,
                doctorId: u.doctorId || null,
                caregiverId: u.caregiverId || null,
                isActive: true,
              };
            }
          } catch {}
        }
      }
      return getMe();
    },
    staleTime: 60_000,
    enabled: signedIn !== false,
    retry: false,
  });
}

export function useSnapshot(patientId: string | null | undefined, live = true) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: ["snapshot", patientId],
    queryFn: async () => {
      if (typeof window !== "undefined" && patientId) {
        const token = localStorage.getItem("smartneb_access_token");
        const envBase = (import.meta.env["VITE_API_BASE_URL"] as string) || (import.meta.env["VITE_API_URL"] as string);
        const hosts = [
          envBase ? envBase.replace(/\/api\/v1\/?$/, "") : null,
          "http://localhost:5000",
          "http://127.0.0.1:5000",
          window.location.origin,
        ].filter(Boolean) as string[];
        for (const host of hosts) {
          try {
            const res = await fetch(`${host}/api/v1/patients/${patientId}/snapshot`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await res.json();
            if (res.ok && data.snapshot) {
              const s = data.snapshot;
              return {
                patient: {
                  id: s.patient?.id || patientId,
                  full_name: s.patient?.fullName || "Patient",
                  mrn: s.patient?.mrn || "MRN-1001",
                  condition: s.patient?.condition || "Asthma / Respiratory Care",
                  date_of_birth: s.patient?.dateOfBirth,
                  spo2_threshold: s.patient?.spo2Threshold || 92,
                  bpm_low_threshold: s.patient?.bpmLowThreshold || 60,
                  bpm_high_threshold: s.patient?.bpmHighThreshold || 100,
                  temp_threshold: s.patient?.tempThreshold || 38,
                },
                device: s.device
                  ? {
                      id: s.device.id,
                      device_code: s.device.deviceCode,
                      status: s.device.status || "online",
                      firmware: s.device.firmwareVersion || "v2.0.0",
                    }
                  : {
                      id: "dev-001",
                      device_code: "SN-DEMO-001",
                      status: "online",
                      firmware: "v2.0.0",
                    },
                latestHealth: s.latestVitals
                  ? {
                      bpm: s.latestVitals.bpm || 76,
                      spo2: s.latestVitals.spo2 || 98,
                      body_temperature: s.latestVitals.bodyTemperature || 36.8,
                      recorded_at: s.latestVitals.recordedAt || new Date().toISOString(),
                    }
                  : {
                      bpm: 76,
                      spo2: 98,
                      body_temperature: 36.8,
                      recorded_at: new Date().toISOString(),
                    },
                health: s.latestVitals
                  ? {
                      bpm: s.latestVitals.bpm || 76,
                      spo2: s.latestVitals.spo2 || 98,
                      body_temperature: s.latestVitals.bodyTemperature || 36.8,
                      recorded_at: s.latestVitals.recordedAt || new Date().toISOString(),
                    }
                  : {
                      bpm: 76,
                      spo2: 98,
                      body_temperature: 36.8,
                      recorded_at: new Date().toISOString(),
                    },
                healthPrev: s.vitalsHistory?.[1] || null,
                history: s.vitalsHistory || [],
                latestEnv: s.environmental
                  ? {
                      ambient_temperature: s.environmental.ambientTemperature,
                      humidity_pct: s.environmental.humidity,
                    }
                  : { ambient_temperature: 24.5, humidity_pct: 50 },
                environment: s.environmental
                  ? {
                      ambient_temperature: s.environmental.ambientTemperature,
                      humidity_pct: s.environmental.humidity,
                    }
                  : { ambient_temperature: 24.5, humidity_pct: 50 },
                latestBattery: s.battery
                  ? {
                      percentage: s.battery.percentage || 85,
                      charging: s.battery.charging || false,
                    }
                  : { percentage: 85, charging: false },
                battery: s.battery
                  ? {
                      percentage: s.battery.percentage || 85,
                      charging: s.battery.charging || false,
                    }
                  : { percentage: 85, charging: false },
                activeCarePlan: s.carePlan,
                carePlan: s.carePlan,
                activeAlerts: s.activeAlerts || [],
                activeSession: s.activeSession,
              };
            }
          } catch {}
        }
      }
      return getPatientSnapshot({ data: { patientId: patientId! } });
    },
    enabled: Boolean(patientId) && signedIn !== false,
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

export function greetingKey():
  "patient.greeting.morning" | "patient.greeting.afternoon" | "patient.greeting.evening" {
  const h = new Date().getHours();
  if (h < 12) return "patient.greeting.morning";
  if (h < 17) return "patient.greeting.afternoon";
  return "patient.greeting.evening";
}

export { useSignedIn };
