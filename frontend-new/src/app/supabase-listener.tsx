"use client";

import { useEffect } from "react";
import { supabase } from "@/services/supabase";
import { useRouter } from "next/navigation";

// Global variable to track if we've already handled a sign-in
let hasHandledSignIn = false;

export default function SupabaseListener() {
  const router = useRouter();

  useEffect(() => {
    // Only handle SIGNED_OUT events and initial SIGNED_IN
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`SupabaseListener: Auth event: ${event}`);

        // Always send session to server for cookie setting
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

        // Handle sign-out
        if (event === "SIGNED_OUT") {
          console.log("SupabaseListener: User signed out, redirecting to login");
          hasHandledSignIn = false; // Reset for next sign-in
          router.push("/auth/login");
          return;
        }

        // Handle sign-in (only once per page load)
        if (event === "SIGNED_IN" && !hasHandledSignIn) {
          hasHandledSignIn = true;
          console.log("SupabaseListener: New sign-in detected");
          
          // Only redirect if on auth pages, otherwise do nothing
          const currentPath = window.location.pathname;
          if (currentPath.startsWith('/auth/')) {
            router.push("/dashboard");
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
