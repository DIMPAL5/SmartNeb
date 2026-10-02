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

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new NoSessionError();

    return next({ headers: { Authorization: `Bearer ${token}` } });
  },
);
