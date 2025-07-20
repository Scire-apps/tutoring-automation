"use client";

import { useEffect } from "react";
import { supabase } from "@/services/supabase";
import { useRouter } from "next/navigation";

export default function SupabaseListener() {
  const router = useRouter();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("SupabaseListener: Auth state change:", event);

      // ➊ send the session to the server so it can set cookies
      try {
        await fetch("/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ event, session }),
        });
        console.log("SupabaseListener: Session sent to server");
      } catch (error) {
        console.error(
          "SupabaseListener: Error sending session to server:",
          error
        );
      }

      // ➋ handle navigation based on auth event
      if (event === "SIGNED_OUT") {
        console.log(
          "SupabaseListener: SIGNED_OUT event received, navigating to /auth/login"
        );
        router.push("/auth/login"); // navigate *after* cookies are gone
      } else if (event === "SIGNED_IN" && session?.user) {
        console.log("SupabaseListener: SIGNED_IN event received");
        
        // Check if we're currently on an auth page - if so, let the login page handle the redirect
        const currentPath = window.location.pathname;
        if (currentPath.startsWith('/auth/')) {
          console.log("SupabaseListener: Currently on auth page, letting login page handle redirect");
          // Don't interfere with login page redirect logic
          return;
        }
        
        // For other pages, just refresh to let the middleware handle protection
        console.log("SupabaseListener: Not on auth page, refreshing to update auth state");
        router.refresh();
      } else {
        console.log("SupabaseListener: Other event received, refreshing page");
        router.refresh(); // keep the old behaviour for other events
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  return null; // nothing to render
}
