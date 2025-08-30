"use client";

import { useEffect } from "react";
import { supabase } from "@/services/supabase";
import { useRouter } from "next/navigation";

// Remove global gating; rely on path checks to avoid redirect loops

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
          router.push("/auth/login");
          return;
        }

        // Handle sign-in or session ready: redirect based on backend role
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          console.log("SupabaseListener: Sign-in/session ready detected");

          const currentPath = window.location.pathname;
          // Only redirect from root or auth pages; avoid interrupting other pages
          if (currentPath === '/' || currentPath.startsWith('/auth/')) {
            try {
              const { data: { session: cur } } = await supabase.auth.getSession();
              const token = cur?.access_token;
              if (!token) return;
              const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://tutoring-automation-sdt9.onrender.com";
              const resp = await fetch(`${apiBase}/api/auth/role`, {
                headers: { Authorization: `Bearer ${token}` },
                credentials: 'include',
              });
              if (!resp.ok) return;
              const json = await resp.json();
              const role = json.role;
              if (role === 'admin') return router.replace('/admin/dashboard');
              if (role === 'tutor') return router.replace('/tutor/dashboard');
              if (role === 'tutee') return router.replace('/tutee/dashboard');
            } catch (e) {
              console.error('SupabaseListener: role redirect error', e);
            }
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
