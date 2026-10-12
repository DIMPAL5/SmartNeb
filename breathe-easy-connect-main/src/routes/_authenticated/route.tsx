import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // During SSR, allow pre-render through so browser client can hydrate from localStorage
    if (typeof window === "undefined") {
      return {};
    }

    try {
      const stored =
        localStorage.getItem("smartneb_user") || sessionStorage.getItem("smartneb_user");
      if (stored) {
        const user = JSON.parse(stored);
        if (user) return { user };
      }
    } catch {
      // ignore parse error
    }

    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user) return { user: data.user };
    } catch {
      // ignore
    }

    throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
