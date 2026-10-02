import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Tracks whether a Supabase session exists so authed queries never fire signed out. */
export function useSignedIn() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setSignedIn(Boolean(session));
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return signedIn;
}
