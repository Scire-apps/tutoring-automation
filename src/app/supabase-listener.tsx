"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

/**
 * Bridges Supabase auth events to React Router state. With cookie-native sessions
 * (@supabase/ssr) the server already sees the fresh cookie on the next request, so
 * any auth change just needs the RSC tree re-fetched — `router.refresh()` does that
 * without a full reload. No redirects here: routing decisions live in the proxy
 * (§3.4) and zone layouts. Deliberately router.refresh()-only so a SIGNED_OUT never
 * forces navigation toward /auth/login (preserves the /admin-login secrecy posture).
 */
export default function SupabaseListener() {
  const router = useRouter();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      router.refresh();
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
