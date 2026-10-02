import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./states";
import { useT } from "@/i18n";

export function RolePlaceholder({ role }: { role: string }) {
  const navigate = useNavigate();
  const t = useT();
  const LABEL: Record<string, string> = {
    doctor: t("role.doctor"),
    caregiver: t("role.caregiver"),
    admin: t("role.admin"),
    "super-admin": t("role.super_admin"),
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-lg space-y-6">
        <EmptyState
          title={t("caregiver.workspaceNext", { role: LABEL[role] ?? role })}
          description={t("caregiver.workspaceNextDescription")}
        />
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth", replace: true });
            }}
          >
            {t("action.signOut")}
          </Button>
        </div>
      </div>
    </div>
  );
}
