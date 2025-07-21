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
        
        // Use sessionStorage to track if this is a genuine sign-in or just a tab focus event
        const lastSignInTime = sessionStorage.getItem('lastSignInTime');
        const currentTime = Date.now();
        
        // If this is the first sign-in or it's been more than 5 minutes since last sign-in event
        // (to handle actual re-authentication)
        if (!lastSignInTime || (currentTime - parseInt(lastSignInTime)) > 300000) {
          console.log("SupabaseListener: New sign-in detected, refreshing to update auth state");
          sessionStorage.setItem('lastSignInTime', currentTime.toString());
          router.refresh();
        } else {
          console.log("SupabaseListener: Ignoring duplicate SIGNED_IN event (likely tab focus)");
          // Update the timestamp but don't refresh
          sessionStorage.setItem('lastSignInTime', currentTime.toString());
        }
      } else if (event !== "INITIAL_SESSION") { // Don't refresh on initial session load
        console.log("SupabaseListener: Other event received:", event);
        // Only refresh for meaningful events, not just state checks
        if (["PASSWORD_RECOVERY", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) {
          router.refresh();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  return null; // nothing to render
}
