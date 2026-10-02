import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Bot, Cpu, ShieldCheck, Siren, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { LanguageSelect } from "@/components/smartneb/language-select";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SmartNeb — Connected Respiratory Therapy" },
      {
        name: "description",
        content:
          "SmartNeb links IoT nebulizers, live vitals and clinical teams so respiratory therapy is monitored, adherent and safe.",
      },
      { property: "og:title", content: "SmartNeb — Connected Respiratory Therapy" },
      {
        property: "og:description",
        content: "Real-time nebulizer control, vitals monitoring, adherence tracking and emergency escalation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Activity, titleKey: "landing.feature.vitals.title", bodyKey: "landing.feature.vitals.body" },
  { icon: Wind, titleKey: "landing.feature.nebulizer.title", bodyKey: "landing.feature.nebulizer.body" },
  { icon: Siren, titleKey: "landing.feature.sos.title", bodyKey: "landing.feature.sos.body" },
  { icon: Cpu, titleKey: "landing.feature.telemetry.title", bodyKey: "landing.feature.telemetry.body" },
  { icon: Bot, titleKey: "landing.feature.assistant.title", bodyKey: "landing.feature.assistant.body" },
  { icon: ShieldCheck, titleKey: "landing.feature.access.title", bodyKey: "landing.feature.access.body" },
] as const;

function Landing() {
  const t = useT();
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Wind className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold">SmartNeb</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSelect className="h-9 w-[128px]" withIcon />
          <Button asChild>
            <Link to="/auth">{t("landing.signIn")}</Link>
          </Button>
        </div>
      </header>

      <section className="grid-mesh border-y">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
            {t("landing.badge")}
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-6xl">
            {t("landing.heroTitle")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground">
            {t("landing.heroBody")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/auth">{t("landing.openPlatform")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.titleKey} className="panel p-6">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <f.icon className="size-5" />
              </span>
              <h2 className="mt-4 font-display text-base font-semibold">{t(f.titleKey)}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t(f.bodyKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        {t("landing.footer")}
      </footer>
    </main>
  );
}
