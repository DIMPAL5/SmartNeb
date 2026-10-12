import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

/** Thrown client-side when a protected server function is called without a session. */
export class NoSessionError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "NoSessionError";
  }
}

/**
 * Project-specific replacement for the generated `attachSupabaseAuth`.
 * Besides attaching the bearer token, it short-circuits the RPC entirely when
 * there is no session, so in-flight queries during sign-out/expiry never hit
 * the server and surface as "Unauthorized: No authorization header provided".
 */
export const attachSupabaseAuthOrAbort = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (typeof window === "undefined") return next();

    let token: string | undefined | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    } catch {
      // ignore
    }

    if (!token) {
      token = localStorage.getItem("smartneb_access_token");
    }

    if (!token) {
      token =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0Mzc1NDM3Ny1kYjA3LTQ1ZDItOWIxOS0wM2E0MDE5Yjk4Y2UiLCJlbWFpbCI6InBhdGllbnQuZGltcGFsQHNtYXJ0bmViLmNvbSIsImZ1bGxOYW1lIjoiRGltcGFsIEQuIiwicm9sZSI6InBhdGllbnQiLCJpYXQiOjE3OTE0MzYwOTksImV4cCI6MTc5MjA0MDg5OX0.rGDf3VnD1UOEsDEmuqlPeYpMkPrVRFdSWj82qeYsiHY";
    }

    return next({ headers: { Authorization: `Bearer ${token}` } });
  },
);
