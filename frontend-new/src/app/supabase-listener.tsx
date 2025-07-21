"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/services/supabase";
import { useRouter } from "next/navigation";

export default function SupabaseListener() {
  const router = useRouter();
  const initialTokenRef = useRef<string | null>(null);
  const hasReloadedRef = useRef(false);

  useEffect(() => {
    // Capture the token on first mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      initialTokenRef.current = session?.access_token ?? null;
      console.log("SupabaseListener: Initial token captured");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`SupabaseListener: Auth event: ${event}`);

        if (event === "SIGNED_OUT") {
          console.log("SupabaseListener: User signed out, redirecting to login");
          hasReloadedRef.current = false;
          initialTokenRef.current = null;
          router.push("/auth/login");
          return;
        }

        if (event === "SIGNED_IN") {
          const newToken = session?.access_token ?? null;
          
          // Only reload if token really changed and we haven't reloaded yet
          if (
            !hasReloadedRef.current &&
            newToken &&
            newToken !== initialTokenRef.current
          ) {
            console.log("SupabaseListener: New token detected, refreshing");
            hasReloadedRef.current = true;
            initialTokenRef.current = newToken;
            
            // Send to server and then refresh
            try {
              await fetch("/auth/callback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ event, session }),
              });
            } catch (error) {
              console.error("SupabaseListener: Error sending session to server:", error);
            }
            
            // Only redirect if on auth pages, otherwise just refresh
            const currentPath = window.location.pathname;
            if (currentPath.startsWith('/auth/')) {
              router.push("/dashboard");
            } else {
              router.refresh();
            }
          } else {
            console.log("SupabaseListener: Ignoring duplicate SIGNED_IN event (same token or already reloaded)");
            
            // Still send session to server for cookie setting, but don't refresh
            try {
              await fetch("/auth/callback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ event, session }),
              });
            } catch (error) {
              console.error("SupabaseListener: Error sending session to server:", error);
            }
          }
        }
      }
    );

    return () => {
      // Cleanup to avoid multiple listeners
      subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
