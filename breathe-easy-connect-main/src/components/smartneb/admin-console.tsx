import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Cpu,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getAdminOverview,
  listAdminAlerts,
  listAdminDevices,
  listAdminPatients,
  listAdminStaff,
  listAdminUsers,
  listAuditLogs,
  registerDevice,
  setAssignment,
  setUserActive,
  updateDevice,
  type AdminDeviceRow,
  type AdminPatientRow,
} from "@/lib/admin.functions";
import { AppShell, adminNav, superAdminNav } from "./app-shell";
import { useMe, useSignedIn } from "./patient-layout";
import { SOSPanel } from "./sos-panel";
import { EmptyState, ErrorState, LoadingSkeleton } from "./states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

function ago(iso: string | null, t: ReturnType<typeof useT>) {
  if (!iso) return t("admin.never");
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t("admin.justNow");
  if (mins < 60) return t("admin.minutesAgo", { count: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t("admin.hoursAgo", { count: hours });
  return t("admin.daysAgo", { count: Math.round(hours / 24) });
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Activity;
  tone?: "default" | "critical" | "warning" | "ok";
}) {
  return (
    <div className="panel flex items-start gap-3 p-4">
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          tone === "critical"
            ? "bg-destructive/10 text-destructive"
            : tone === "warning"
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : tone === "ok"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="font-display text-2xl font-semibold">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

export function AdminConsole({ scope = "admin" }: { scope?: "admin" | "super_admin" }) {
  const t = useT();
  const me = useMe();
  const signedIn = useSignedIn();
  const queryClient = useQueryClient();

  const enabled = signedIn === true && me.data?.role !== undefined;
  const staff = me.data?.role === "admin" || me.data?.role === "super_admin";
  const on = enabled && staff;

  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => getAdminOverview(),
    enabled: on,
    retry: false,
    refetchInterval: on ? 15_000 : false,
  });

  useEffect(() => {
    if (!on) return;
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-devices"] });
    };
    const channel = supabase
      .channel("admin-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "health_telemetry" },
        invalidate,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "sos_events" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "devices" }, invalidate)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [on, queryClient]);

  if (me.isPending) {
    return (
      <div className="p-8">
        <LoadingSkeleton rows={4} />
      </div>
    );
  }
  if (me.isError || !me.data) {
    return (
      <div className="p-8">
        <ErrorState message={(me.error as Error)?.message} onRetry={() => me.refetch()} />
      </div>
    );
  }
  if (!staff) {
    return (
      <div className="p-8">
        <ErrorState message={t("admin.accessRequired")} />
      </div>
    );
  }

  const o = overview.data;

  return (
    <AppShell
      me={me.data}
      nav={scope === "super_admin" ? superAdminNav : adminNav}
      title={scope === "super_admin" ? t("nav.platformConsole") : t("nav.adminConsole")}
      subtitle={
        o
          ? t("admin.subtitle", {
              users: o.users.total,
              devices: o.devices.total,
              alerts: o.alerts.active,
              sos: o.sos.active,
            })
          : t("admin.loadingStatus")
      }
      actions={
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("admin.refreshData")}
          onClick={() => void queryClient.invalidateQueries()}
        >
          <RefreshCw className="size-4" />
        </Button>
      }
    >
      <div className="space-y-6">
        {overview.isError ? (
          <ErrorState
            message={(overview.error as Error)?.message}
            onRetry={() => overview.refetch()}
          />
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label={t("admin.users")}
            value={o?.users.total ?? "--"}
            hint={t("admin.usersHint", {
              active: o?.users.active ?? 0,
              inactive: o?.users.inactive ?? 0,
            })}
            icon={Users}
          />
          <Stat
            label={t("admin.devicesOnline")}
            value={`${o?.devices.online ?? 0}/${o?.devices.total ?? 0}`}
            hint={t("admin.devicesHint", {
              mqtt: o?.devices.mqttConnected ?? 0,
              unassigned: o?.devices.unassigned ?? 0,
            })}
            icon={Cpu}
            tone={o && o.devices.online === 0 && o.devices.total > 0 ? "warning" : "ok"}
          />
          <Stat
            label={t("admin.activeAlerts")}
            value={o?.alerts.active ?? 0}
            hint={t("admin.alertsHint", {
              critical: o?.alerts.critical ?? 0,
              warning: o?.alerts.warning ?? 0,
            })}
            icon={AlertTriangle}
            tone={o?.alerts.critical ? "critical" : "default"}
          />
          <Stat
            label={t("admin.liveSOS")}
            value={o?.sos.active ?? 0}
            hint={t("admin.sosHint", {
              acknowledged: o?.sos.acknowledged ?? 0,
              last24h: o?.sos.last24h ?? 0,
            })}
            icon={Siren}
            tone={o?.sos.active ? "critical" : "ok"}
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label={t("admin.telemetry1h")}
            value={o?.telemetry.lastHour ?? 0}
            hint={t("admin.telemetry1hHint", {
              patients: o?.telemetry.patientsReporting ?? 0,
              last: ago(o?.telemetry.lastRecordedAt ?? null, t),
            })}
            icon={Activity}
            tone={o && o.telemetry.lastHour === 0 ? "warning" : "ok"}
          />
          <Stat
            label={t("admin.telemetry24h")}
            value={o?.telemetry.last24h ?? 0}
            hint={t("admin.telemetry24hHint", { stale: o?.telemetry.stalePatients ?? 0 })}
            icon={Activity}
          />
          <Stat
            label={t("admin.therapySessions")}
            value={o?.sessions.running ?? 0}
            hint={t("admin.therapyHint", { completed: o?.sessions.completedToday ?? 0 })}
            icon={ShieldCheck}
          />
          <Stat
            label={t("admin.unassignedPatients")}
            value={o?.unassignedPatients ?? 0}
            hint={t("admin.unassignedHint")}
            icon={Users}
            tone={o?.unassignedPatients ? "warning" : "ok"}
          />
        </section>

        <SOSPanel enabled={on} title={t("admin.emergencySOSPlatform")} />

        <Tabs defaultValue="users">
          <TabsList className="flex-wrap">
            <TabsTrigger value="users">{t("admin.tabs.users")}</TabsTrigger>
            <TabsTrigger value="assignments">{t("admin.tabs.assignments")}</TabsTrigger>
            <TabsTrigger value="devices">{t("admin.tabs.devices")}</TabsTrigger>
            <TabsTrigger value="alerts">{t("admin.tabs.alerts")}</TabsTrigger>
            <TabsTrigger value="audit">{t("admin.tabs.audit")}</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <UsersTab enabled={on} />
          </TabsContent>
          <TabsContent value="assignments" className="mt-4">
            <AssignmentsTab enabled={on} />
          </TabsContent>
          <TabsContent value="devices" className="mt-4">
            <DevicesTab enabled={on} />
          </TabsContent>
          <TabsContent value="alerts" className="mt-4">
            <AlertsTab enabled={on} />
          </TabsContent>
          <TabsContent value="audit" className="mt-4">
            <AuditTab enabled={on} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

/* ------------------------------ Users ------------------------------ */

function UsersTab({ enabled }: { enabled: boolean }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listAdminUsers(),
    enabled,
    retry: false,
  });

  const toggle = useMutation({
    mutationFn: (vars: { userId: string; active: boolean }) => setUserActive({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(vars.active ? t("admin.accountActivated") : t("admin.accountDeactivated"));
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-audit"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = users.data ?? [];
    return needle
      ? list.filter(
          (u) =>
            u.fullName.toLowerCase().includes(needle) ||
            (u.email ?? "").toLowerCase().includes(needle) ||
            u.roles.join(" ").includes(needle),
        )
      : list;
  }, [users.data, q]);

  if (users.isLoading) return <LoadingSkeleton rows={4} />;
  if (users.isError)
    return <ErrorState message={(users.error as Error)?.message} onRetry={() => users.refetch()} />;

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("admin.searchUsersPlaceholder")}
          aria-label={t("admin.searchUsers")}
          className="h-9 max-w-sm"
        />
        <span className="ml-auto text-xs text-muted-foreground">
          {t("admin.accountsCount", { count: rows.length })}
        </span>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={t("admin.noUsersFound")} description={t("admin.noUsersFoundDesc")} />
      ) : (
        <ScrollArea className="mt-3 max-h-[32rem]">
          <ul className="space-y-2 pr-2">
            {rows.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{u.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.email ?? t("admin.noEmail")} ·{" "}
                    {t("admin.joined", { date: new Date(u.createdAt).toLocaleDateString() })}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(u.roles.length ? u.roles : [t("admin.noRole")]).map((r) => (
                      <Badge key={r} variant="secondary" className="capitalize">
                        {r.replace("_", " ")}
                      </Badge>
                    ))}
                    {u.mrn ? <Badge variant="outline">{u.mrn}</Badge> : null}
                    {u.specialty ? <Badge variant="outline">{u.specialty}</Badge> : null}
                    {u.relation ? <Badge variant="outline">{u.relation}</Badge> : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {u.isActive ? t("status.active") : t("admin.deactivated")}
                  </span>
                  <Switch
                    checked={u.isActive}
                    aria-label={`${u.isActive ? t("admin.deactivate") : t("admin.activate")} ${u.fullName}`}
                    onCheckedChange={(next) =>
                      toggle.mutate({ userId: u.id, active: Boolean(next) })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}

/* --------------------------- Assignments --------------------------- */

function AssignmentsTab({ enabled }: { enabled: boolean }) {
  const t = useT();
  const queryClient = useQueryClient();
  const patients = useQuery({
    queryKey: ["admin-patients"],
    queryFn: () => listAdminPatients(),
    enabled,
    retry: false,
  });
  const staff = useQuery({
    queryKey: ["admin-staff"],
    queryFn: () => listAdminStaff(),
    enabled,
    retry: false,
  });

  const assign = useMutation({
    mutationFn: (vars: {
      patientId: string;
      kind: "doctor" | "caregiver";
      staffId: string;
      action: "assign" | "unassign";
    }) => setAssignment({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(
        vars.action === "assign" ? t("admin.careTeamAssigned") : t("admin.assignmentRemoved"),
      );
      void queryClient.invalidateQueries({ queryKey: ["admin-patients"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-audit"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (patients.isLoading || staff.isLoading) return <LoadingSkeleton rows={4} />;
  if (patients.isError)
    return (
      <ErrorState message={(patients.error as Error)?.message} onRetry={() => patients.refetch()} />
    );

  const list = patients.data ?? [];
  if (!list.length)
    return (
      <EmptyState title={t("admin.noPatientsYet")} description={t("admin.noPatientsYetDesc")} />
    );

  return (
    <div className="space-y-3">
      {list.map((p) => (
        <AssignmentCard
          key={p.id}
          patient={p}
          doctors={staff.data?.doctors ?? []}
          caregivers={staff.data?.caregivers ?? []}
          onChange={(kind, staffId, action) =>
            assign.mutate({ patientId: p.id, kind, staffId, action })
          }
        />
      ))}
    </div>
  );
}

function AssignmentCard({
  patient,
  doctors,
  caregivers,
  onChange,
}: {
  patient: AdminPatientRow;
  doctors: { id: string; name: string; specialty: string }[];
  caregivers: { id: string; name: string; relation: string }[];
  onChange: (kind: "doctor" | "caregiver", staffId: string, action: "assign" | "unassign") => void;
}) {
  const t = useT();
  const freeDoctors = doctors.filter((d) => !patient.doctors.some((x) => x.id === d.id));
  const freeCaregivers = caregivers.filter((c) => !patient.caregivers.some((x) => x.id === c.id));

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold">{patient.fullName}</p>
          <p className="text-xs text-muted-foreground">
            {patient.mrn} · {patient.condition ?? t("admin.noConditionRecorded")} ·{" "}
            {patient.userLinked ? t("admin.accountLinked") : t("admin.noLoginLinked")}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={patient.deviceCode ? "secondary" : "outline"}>
            {patient.deviceCode ?? t("admin.noDevice")}
            {patient.deviceStatus ? ` · ${patient.deviceStatus}` : ""}
          </Badge>
          <Badge variant="outline">
            {t("admin.telemetryAgo", { time: ago(patient.lastTelemetryAt, t) })}
          </Badge>
          {patient.activeSOS ? <Badge variant="destructive">{t("admin.sosBadge")}</Badge> : null}
          {patient.activeAlerts ? (
            <Badge variant="destructive">
              {t("admin.alertsBadge", { count: patient.activeAlerts })}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <TeamColumn
          heading={t("admin.doctors")}
          members={patient.doctors}
          options={freeDoctors.map((d) => ({ id: d.id, label: `${d.name} · ${d.specialty}` }))}
          onAssign={(id) => onChange("doctor", id, "assign")}
          onRemove={(id) => onChange("doctor", id, "unassign")}
        />
        <TeamColumn
          heading={t("admin.caregivers")}
          members={patient.caregivers}
          options={freeCaregivers.map((c) => ({ id: c.id, label: `${c.name} · ${c.relation}` }))}
          onAssign={(id) => onChange("caregiver", id, "assign")}
          onRemove={(id) => onChange("caregiver", id, "unassign")}
        />
      </div>
    </div>
  );
}

function TeamColumn({
  heading,
  members,
  options,
  onAssign,
  onRemove,
}: {
  heading: string;
  members: { id: string; name: string }[];
  options: { id: string; label: string }[];
  onAssign: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const t = useT();
  const [pick, setPick] = useState("");
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {heading}
      </p>
      {members.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("admin.noneAssigned")}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2">
              <span className="truncate text-sm">{m.name}</span>
              <Button size="sm" variant="ghost" onClick={() => onRemove(m.id)}>
                {t("admin.remove")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        <Select value={pick} onValueChange={setPick}>
          <SelectTrigger
            className="h-9"
            aria-label={t("admin.selectRole", { role: heading.toLowerCase() })}
          >
            <SelectValue
              placeholder={t("admin.addRole", { role: heading.slice(0, -1).toLowerCase() })}
            />
          </SelectTrigger>
          <SelectContent>
            {options.length === 0 ? (
              <SelectItem value="none" disabled>
                {t("admin.noOneAvailable")}
              </SelectItem>
            ) : (
              options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={!pick || pick === "none"}
          onClick={() => {
            onAssign(pick);
            setPick("");
          }}
        >
          {t("admin.assign")}
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------- Devices ----------------------------- */

function DevicesTab({ enabled }: { enabled: boolean }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [firmware, setFirmware] = useState("");

  const devices = useQuery({
    queryKey: ["admin-devices"],
    queryFn: () => listAdminDevices(),
    enabled,
    retry: false,
    refetchInterval: enabled ? 20_000 : false,
  });
  const patients = useQuery({
    queryKey: ["admin-patients"],
    queryFn: () => listAdminPatients(),
    enabled,
    retry: false,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-devices"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-patients"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-audit"] });
  };

  const create = useMutation({
    mutationFn: (vars: { deviceCode: string; firmware?: string }) => registerDevice({ data: vars }),
    onSuccess: () => {
      toast.success(t("admin.deviceRegistered"));
      setCode("");
      setFirmware("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (vars: {
      deviceId: string;
      patientId?: string | null;
      status?: "online" | "offline" | "maintenance" | "disabled";
    }) => updateDevice({ data: vars }),
    onSuccess: () => {
      toast.success(t("admin.deviceUpdated"));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <form
        className="panel flex flex-wrap items-end gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim().length < 3) {
            toast.error(t("admin.deviceCodeTooShort"));
            return;
          }
          const fw = firmware.trim();
          create.mutate({ deviceCode: code.trim(), ...(fw ? { firmware: fw } : {}) });
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="device-code">{t("admin.deviceCode")}</Label>
          <Input
            id="device-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="SNB-0007"
            className="h-10 w-48"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="device-fw">{t("admin.firmware")}</Label>
          <Input
            id="device-fw"
            value={firmware}
            onChange={(e) => setFirmware(e.target.value)}
            placeholder="1.0.0"
            className="h-10 w-32"
          />
        </div>
        <Button type="submit" disabled={create.isPending} className="h-10">
          <Plus className="mr-2 size-4" /> {t("admin.registerDevice")}
        </Button>
      </form>

      {devices.isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : devices.isError ? (
        <ErrorState message={(devices.error as Error)?.message} onRetry={() => devices.refetch()} />
      ) : (devices.data ?? []).length === 0 ? (
        <EmptyState
          title={t("admin.noDevicesRegistered")}
          description={t("admin.noDevicesRegisteredDesc")}
        />
      ) : (
        <div className="space-y-3">
          {(devices.data ?? []).map((d) => (
            <DeviceCard
              key={d.id}
              device={d}
              patients={patients.data ?? []}
              onAssign={(patientId) => update.mutate({ deviceId: d.id, patientId })}
              onStatus={(status) => update.mutate({ deviceId: d.id, status })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DeviceCard({
  device,
  patients,
  onAssign,
  onStatus,
}: {
  device: AdminDeviceRow;
  patients: AdminPatientRow[];
  onAssign: (patientId: string | null) => void;
  onStatus: (status: "online" | "offline" | "maintenance" | "disabled") => void;
}) {
  const t = useT();
  return (
    <div className="panel grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-base font-semibold">{device.deviceCode}</p>
          <Badge
            variant={device.status === "online" ? "secondary" : "outline"}
            className="capitalize"
          >
            {device.status}
          </Badge>
          <Badge variant="outline" className="gap-1">
            {device.mqttConnected ? (
              <Wifi className="size-3" aria-hidden />
            ) : (
              <WifiOff className="size-3" aria-hidden />
            )}
            {t("admin.mqttStatus", {
              state: device.mqttConnected ? t("admin.up") : t("admin.down"),
            })}
          </Badge>
          <Badge variant="outline">
            {t("admin.cloudStatus", {
              state: device.cloudConnected ? t("admin.up") : t("admin.down"),
            })}
          </Badge>
          <Badge variant="outline">{t("admin.fwLabel", { version: device.firmware })}</Badge>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {device.patientName ? `${device.patientName} · ${device.mrn}` : t("admin.unassigned")} ·{" "}
          {t("admin.nebulizerState", { state: device.nebulizerState })} ·{" "}
          {t("admin.fluidLevel", { percent: Math.round(device.fluidLevel) })} ·{" "}
          {t("admin.seenAgo", { time: ago(device.lastSeenAt, t) })} ·{" "}
          {t("admin.telemetryAgo", { time: ago(device.lastTelemetryAt, t) })}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={device.patientId ?? "unassigned"}
          onValueChange={(v) => onAssign(v === "unassigned" ? null : v)}
        >
          <SelectTrigger
            className="h-9 w-56"
            aria-label={t("admin.assignPatientTo", { device: device.deviceCode })}
          >
            <SelectValue placeholder={t("admin.assignPatient")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">{t("admin.unassigned")}</SelectItem>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.fullName} · {p.mrn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={device.status} onValueChange={(v) => onStatus(v as "online")}>
          <SelectTrigger
            className="h-9 w-40"
            aria-label={t("admin.setStatusFor", { device: device.deviceCode })}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="online">{t("status.online")}</SelectItem>
            <SelectItem value="offline">{t("status.offline")}</SelectItem>
            <SelectItem value="maintenance">{t("admin.maintenance")}</SelectItem>
            <SelectItem value="disabled">{t("admin.disabled")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/* ----------------------------- Alerts ------------------------------ */

function AlertsTab({ enabled }: { enabled: boolean }) {
  const t = useT();
  const alerts = useQuery({
    queryKey: ["admin-alerts"],
    queryFn: () => listAdminAlerts(),
    enabled,
    retry: false,
    refetchInterval: enabled ? 20_000 : false,
  });

  if (alerts.isLoading) return <LoadingSkeleton rows={4} />;
  if (alerts.isError)
    return (
      <ErrorState message={(alerts.error as Error)?.message} onRetry={() => alerts.refetch()} />
    );
  if (!(alerts.data ?? []).length)
    return (
      <EmptyState
        title={t("admin.noAlertsRecorded")}
        description={t("admin.noAlertsRecordedDesc")}
      />
    );

  return (
    <div className="panel p-4">
      <ScrollArea className="max-h-[32rem]">
        <ul className="space-y-2 pr-2">
          {(alerts.data ?? []).map((a) => (
            <li key={a.id} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={a.severity === "critical" ? "destructive" : "secondary"}
                  className="capitalize"
                >
                  {a.severity}
                </Badge>
                <span className="text-sm font-semibold">{a.patientName}</span>
                <span className="text-xs text-muted-foreground">{a.mrn}</span>
                <Badge variant="outline" className="ml-auto capitalize">
                  {a.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm">{a.message}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {a.type}
                {a.value != null ? ` · ${t("admin.value")} ${a.value}` : ""}
                {a.threshold != null ? ` · ${t("admin.threshold")} ${a.threshold}` : ""} ·{" "}
                {new Date(a.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}

/* ------------------------------ Audit ------------------------------ */

function AuditTab({ enabled }: { enabled: boolean }) {
  const t = useT();
  const [action, setAction] = useState("all");
  const [term, setTerm] = useState("");
  const logs = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => listAuditLogs(),
    enabled,
    retry: false,
  });

  if (logs.isLoading) return <LoadingSkeleton rows={4} />;
  if (logs.isError)
    return <ErrorState message={(logs.error as Error)?.message} onRetry={() => logs.refetch()} />;
  if (!(logs.data ?? []).length)
    return (
      <EmptyState title={t("admin.noAuditActivity")} description={t("admin.noAuditActivityDesc")} />
    );

  const rows = logs.data ?? [];
  const actions = [...new Set(rows.map((l) => l.action))].sort();
  const q = term.trim().toLowerCase();
  const filtered = rows.filter((l) => {
    if (action !== "all" && l.action !== action) return false;
    if (!q) return true;
    return [l.actorName, l.targetType, l.targetId, l.meta]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  return (
    <div className="panel p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t("admin.searchAuditPlaceholder")}
          aria-label={t("admin.searchAuditLog")}
          className="max-w-xs"
        />
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-56" aria-label={t("admin.filterByAction")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.allActions")}</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="self-center text-xs text-muted-foreground">
          {t("admin.entriesOf", { filtered: filtered.length, total: rows.length })}
        </span>
      </div>
      <ScrollArea className="max-h-[32rem]">
        <ul className="divide-y pr-2">
          {filtered.map((l) => (
            <li key={l.id} className="py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{l.action}</Badge>
                <span className="text-sm">{l.actorName ?? t("admin.system")}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(l.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {l.targetType ? `${l.targetType} ${l.targetId ?? ""}` : ""} {l.meta ?? ""}
              </p>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted-foreground">
              {t("admin.noMatchingEntries")}
            </li>
          ) : null}
        </ul>
      </ScrollArea>
    </div>
  );
}
