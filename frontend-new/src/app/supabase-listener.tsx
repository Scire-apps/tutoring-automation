"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/services/supabase";
import { useRouter } from "next/navigation";

export default function SupabaseListener() {
  const router = useRouter();
  const initialSessionProcessed = useRef(false);
  const hasRefreshed = useRef(false);

  useEffect(() => {
    // Skip if we've already processed the initial session
    if (initialSessionProcessed.current) {
      return;
    }
    
    initialSessionProcessed.current = true;
    
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("SupabaseListener: Auth event:", event);
      
      // Only handle critical auth events and ignore tab focus events
      if (event === "SIGNED_OUT") {
        console.log("SupabaseListener: User signed out, redirecting to login");
        router.push("/auth/login");
        hasRefreshed.current = false;
        return;
      }
      
      // For SIGNED_IN, only process it once per page load
      if (event === "SIGNED_IN" && !hasRefreshed.current) {
        console.log("SupabaseListener: New sign-in detected");
        hasRefreshed.current = true;
        
        // Send session to server for cookie setting
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
        
        // Only redirect if on auth pages
        const currentPath = window.location.pathname;
        if (currentPath.startsWith('/auth/')) {
          console.log("SupabaseListener: On auth page, redirecting to dashboard");
          router.push("/dashboard");
        }
      }
      
      // Ignore all other events to prevent unnecessary refreshes
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
