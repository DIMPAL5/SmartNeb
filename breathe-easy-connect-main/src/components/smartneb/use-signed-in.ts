import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function hasLocalSession() {
  if (typeof window === "undefined") return true;
  return (
    Boolean(localStorage.getItem("smartneb_access_token")) ||
    Boolean(localStorage.getItem("smartneb_user"))
  );
}

/** Tracks whether a session exists so authed queries never fire signed out. */
export function useSignedIn() {
  const [signedIn, setSignedIn] = useState<boolean>(() => hasLocalSession());

  useEffect(() => {
    let active = true;

    if (hasLocalSession()) {
      setSignedIn(true);
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setSignedIn(Boolean(session) || hasLocalSession());
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSignedIn(Boolean(data.session) || hasLocalSession());
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return hasLocalSession() || signedIn;
}
