import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Activity, Loader2, ShieldCheck, Wind } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { getMe } from "@/lib/smartneb.functions";
import { roleHome } from "@/components/smartneb/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/i18n";
import { LanguageSelect } from "@/components/smartneb/language-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SmartNeb Respiratory IoT Platform" },
      {
        name: "description",
        content:
          "Sign in to SmartNeb to monitor connected nebulizer therapy, vitals and adherence in real time.",
      },
      { property: "og:title", content: "Sign in — SmartNeb" },
      {
        property: "og:description",
        content: "Secure access to the SmartNeb respiratory therapy monitoring platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const t = useT();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("patient");
  const [mode, setMode] = useState<"signin" | "forgot">("signin");

  async function routeByRole() {
    const me = await getMe();
    navigate({ to: roleHome[me.role], replace: true });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void routeByRole();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("auth.welcomeBack"));
    await routeByRole();
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error(t("auth.enterEmailFirst"));
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("auth.resetLinkSent"));
    setMode("signin");
  }

  function passwordProblem(value: string) {
    if (value.length < 8) return t("auth.passwordMinLength");
    if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value))
      return t("auth.passwordLettersNumbers");
    return null;
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(password);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, role },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("auth.accountCreated"));
    const { data } = await supabase.auth.getSession();
    if (data.session) await routeByRole();
    else toast.info(t("auth.confirmEmailPrompt"));
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(t("auth.googleSignInFailed"));
      return;
    }
    if (result.redirected) return;
    await routeByRole();
  }

  return (
    <div className="grid-mesh flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="absolute right-4 top-4">
        <LanguageSelect className="h-9 w-[128px]" withIcon />
      </div>
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-2 lg:items-center">
        <section className="hidden lg:block">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Wind className="size-5" />
            </div>
            <span className="font-display text-xl font-semibold">SmartNeb</span>
          </div>
          <h2 className="mt-8 font-display text-4xl leading-tight font-semibold">
            {t("auth.heroTitle")}
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">{t("auth.heroBody")}</p>
          <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Activity className="size-4 text-primary" /> {t("auth.heroPoint1")}
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> {t("auth.heroPoint2")}
            </li>
          </ul>
        </section>

        <div className="panel p-6 sm:p-8">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">{t("auth.tabSignIn")}</TabsTrigger>
              <TabsTrigger value="signup">{t("auth.tabSignUp")}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={mode === "forgot" ? sendReset : signIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {mode === "signin" ? (
                  <div className="space-y-2">
                    <Label htmlFor="password">{t("auth.password")}</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("auth.forgotBody")}</p>
                )}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  {mode === "forgot" ? t("auth.sendResetLink") : t("auth.signIn")}
                </Button>
                <button
                  type="button"
                  className="w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => setMode(mode === "forgot" ? "signin" : "forgot")}
                >
                  {mode === "forgot" ? t("auth.backToSignIn") : t("auth.forgotPassword")}
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={signUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("auth.fullName")}</Label>
                  <Input
                    id="name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">{t("auth.iAmA")}</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="patient">{t("auth.rolePatient")}</SelectItem>
                      <SelectItem value="doctor">{t("auth.roleDoctor")}</SelectItem>
                      <SelectItem value="caregiver">{t("auth.roleCaregiver")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2">{t("auth.email")}</Label>
                  <Input
                    id="email2"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">{t("auth.password")}</Label>
                  <Input
                    id="password2"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  {t("auth.createAccount")}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("auth.or")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={google}>
            {t("auth.continueWithGoogle")}
          </Button>
          <p className="mt-6 text-xs text-muted-foreground">{t("auth.demoAccountNote")}</p>
        </div>
      </div>
    </div>
  );
}
