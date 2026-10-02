import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpenCheck,
  Bot,
  CalendarCheck,
  ClipboardList,
  FileText,
  NotebookPen,
  Siren,
  Users,
  Gauge as GaugeIcon,
  HeartHandshake,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Stethoscope,
  User,
  Wind,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type MeContext,
} from "@/lib/smartneb.functions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "./theme";
import { LanguageSelect, useProfileLanguageSync } from "./language-select";
import { useT } from "@/i18n";
import { useSignedIn } from "./use-signed-in";
import { cn } from "@/lib/utils";

type NavItem = { labelKey: string; to: string; icon: typeof Activity };

export const patientNav: NavItem[] = [
  { labelKey: "nav.dashboard", to: "/patient/dashboard", icon: LayoutDashboard },
  { labelKey: "nav.myNebulizer", to: "/patient/nebulizer", icon: Wind },
  { labelKey: "nav.healthMonitoring", to: "/patient/monitoring", icon: Activity },
  { labelKey: "nav.nebulization", to: "/patient/nebulization", icon: GaugeIcon },
  { labelKey: "nav.adherence", to: "/patient/adherence", icon: CalendarCheck },
  { labelKey: "nav.healthHistory", to: "/patient/history", icon: History },
  { labelKey: "nav.alerts", to: "/patient/alerts", icon: AlertTriangle },
  { labelKey: "nav.reports", to: "/patient/reports", icon: FileText },
  { labelKey: "nav.assistant", to: "/patient/assistant", icon: Bot },
  { labelKey: "nav.profile", to: "/patient/profile", icon: User },
  { labelKey: "nav.settings", to: "/patient/settings", icon: Settings },
];

export const doctorNav: NavItem[] = [
  { labelKey: "nav.clinicalDashboard", to: "/doctor/dashboard", icon: Stethoscope },
  { labelKey: "nav.myPatients", to: "/doctor/patients", icon: Users },
  { labelKey: "nav.alerts", to: "/doctor/alerts", icon: AlertTriangle },
  { labelKey: "nav.sos", to: "/doctor/sos", icon: Siren },
  { labelKey: "nav.carePlans", to: "/doctor/care-plans", icon: ClipboardList },
  { labelKey: "nav.clinicalNotes", to: "/doctor/notes", icon: NotebookPen },
  { labelKey: "nav.reports", to: "/doctor/reports", icon: FileText },
  { labelKey: "nav.profile", to: "/doctor/profile", icon: User },
  { labelKey: "nav.settings", to: "/doctor/settings", icon: Settings },
];

export const caregiverNav: NavItem[] = [
  { labelKey: "nav.dashboard", to: "/caregiver/dashboard", icon: HeartHandshake },
  { labelKey: "nav.myPatients", to: "/caregiver/patients", icon: Users },
  { labelKey: "nav.alerts", to: "/caregiver/alerts", icon: AlertTriangle },
  { labelKey: "nav.sos", to: "/caregiver/sos", icon: Siren },
  { labelKey: "nav.carePlans", to: "/caregiver/care-plans", icon: ClipboardList },
  { labelKey: "nav.notes", to: "/caregiver/notes", icon: NotebookPen },
  { labelKey: "nav.profile", to: "/caregiver/profile", icon: User },
];

export const adminNav: NavItem[] = [
  { labelKey: "nav.adminConsole", to: "/admin/dashboard", icon: ShieldCheck },
];

export const superAdminNav: NavItem[] = [
  { labelKey: "nav.platformConsole", to: "/super-admin/dashboard", icon: ShieldCheck },
];

export const roleHome: Record<MeContext["role"], string> = {
  patient: "/patient/dashboard",
  doctor: "/doctor/dashboard",
  caregiver: "/caregiver/dashboard",
  admin: "/admin/dashboard",
  super_admin: "/super-admin/dashboard",
};

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label={t("nav.primary")} className="space-y-1">
      {items.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-glow"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" aria-hidden />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  const t = useT();
  return (
    <div className="flex items-center gap-2.5 px-1 py-1">
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Wind className="size-5" aria-hidden />
      </div>
      <div className="leading-tight">
        <p className="font-display text-base font-semibold">{t("app.name")}</p>
        <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
          {t("app.tagline")}
        </p>
      </div>
    </div>
  );
}

function NotificationBell() {
  const t = useT();
  const signedIn = useSignedIn();
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
    enabled: signedIn === true,
    retry: false,
    refetchInterval: signedIn === true ? 30_000 : false,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["notifications"] });

  const readOne = useMutation({
    mutationFn: (id: string) => markNotificationRead({ data: { id } }),
    onSuccess: invalidate,
  });
  const readAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: invalidate,
  });

  useEffect(() => {
    if (signedIn !== true) return;
    const channel = supabase
      .channel("notification-bell-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () =>
        invalidate(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, signedIn]);

  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;
  const visible = unreadOnly ? items.filter((n) => !n.read_at) : items;

  const tone = (type: string) =>
    type === "sos" || type.includes("critical")
      ? "bg-critical"
      : type.includes("warning") || type === "alert"
        ? "bg-warning"
        : "bg-primary";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("notifications.aria", { count: unread })}>
          <span className="relative">
            <Bell className="size-4" />
            {unread > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-critical text-[10px] font-semibold text-critical-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <p className="font-display text-sm font-semibold">
            {t("notifications.title")}
            {unread > 0 ? ` (${unread})` : ""}
          </p>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setUnreadOnly((v) => !v)}
            >
              {unreadOnly ? t("notifications.all") : t("notifications.unread")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              disabled={unread === 0 || readAll.isPending}
              onClick={() => readAll.mutate()}
            >
              {t("notifications.markAllRead")}
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">{t("state.allCaughtUp")}</p>
          ) : (
            <ul className="divide-y">
              {visible.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                      !n.read_at && "bg-muted/30",
                    )}
                    onClick={() => {
                      if (!n.read_at) readOne.mutate(n.id);
                    }}
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        n.read_at ? "bg-transparent" : tone(n.type),
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{n.title}</span>
                      {n.body ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">{n.body}</span>
                      ) : null}
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({
  me,
  nav,
  title,
  subtitle,
  actions,
  children,
}: {
  me: MeContext;
  nav: NavItem[];
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
}) {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  useProfileLanguageSync();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (me.isActive === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="panel w-full max-w-md space-y-4 p-8 text-center">
          <h1 className="font-display text-xl font-semibold">{t("account.deactivated")}</h1>
          <p className="text-sm text-muted-foreground">{t("account.deactivatedBody")}</p>
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="mr-2 size-3.5" /> {t("action.signOut")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
          <Brand />
          <div className="mt-6 flex-1 overflow-y-auto">
            <NavList items={nav} />
          </div>
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3">
            <p className="truncate text-sm font-medium">{me.fullName}</p>
            <p className="text-xs text-muted-foreground">{t(`role.${me.role}`)}</p>
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={signOut}>
              <LogOut className="mr-2 size-3.5" /> {t("action.signOut")}
            </Button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    aria-label={t("nav.openMenu")}
                  >
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 bg-sidebar p-4">
                  <SheetTitle className="sr-only">{t("nav.navigation")}</SheetTitle>
                  <Brand />
                  <div className="mt-6">
                    <NavList items={nav} onNavigate={() => setOpen(false)} />
                  </div>
                  <Button variant="outline" size="sm" className="mt-6 w-full" onClick={signOut}>
                    <LogOut className="mr-2 size-3.5" /> {t("action.signOut")}
                  </Button>
                </SheetContent>
              </Sheet>

              <div className="min-w-0 flex-1">
                <h1 className="truncate font-display text-lg font-semibold sm:text-xl">{title}</h1>
                {subtitle ? (
                  <p className="truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
                ) : null}
              </div>

              <div className="flex items-center gap-1">
                {actions}
                <LanguageSelect className="hidden h-9 w-[128px] sm:flex" withIcon />
                <NotificationBell />
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main className="px-4 py-6 sm:px-6">{children}</main>

          <footer className="flex items-center gap-2 border-t px-6 py-4 text-xs text-muted-foreground">
            <Stethoscope className="size-3.5" aria-hidden />
            {t("app.disclaimer")}
            <BookOpenCheck className="ml-auto size-3.5" aria-hidden />
          </footer>
        </div>
      </div>
    </div>
  );
}
