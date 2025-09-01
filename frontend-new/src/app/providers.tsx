"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase, getCurrentUser, getSession } from "@/services/supabase";

// Define user role type
type UserRole = "tutor" | "tutee" | "admin" | null;

// Define the auth context type
type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  userRole: UserRole;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    schoolId?: string,
    accountType?: "tutor" | "tutee"
  ) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
};

// Create the auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole>(null);

  // Function to determine user role via backend (avoids direct DB queries from frontend)
  const determineUserRole = async (
    accessToken: string | null
  ): Promise<UserRole> => {
    try {
      if (!accessToken) return null;
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL ||
        "https://tutoring-automation-sdt9.onrender.com";
      const resp = await fetch(`${apiBase}/api/auth/role`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include",
      });
      if (!resp.ok) return null;
      const json = await resp.json();
      return (json.role as UserRole) ?? null;
    } catch (error) {
      console.error(
        "Auth context: Error determining user role via backend:",
        error
      );
      return null;
    }
  };

  // Ensure a tutor/tutee row exists after verification/login
  const ensureBackendAccount = async (
    accessToken: string,
    accountType: "tutor" | "tutee",
    firstName?: string,
    lastName?: string,
    schoolId?: string
  ) => {
    try {
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL ||
        "https://tutoring-automation-sdt9.onrender.com";
      // Build body with core fields
      const body: any = {
        account_type: accountType,
        first_name: firstName,
        last_name: lastName,
        school_id: schoolId,
      };
      // For tutee, include extras from localStorage if present
      if (typeof window !== "undefined" && accountType === "tutee") {
        try {
          const gy = window.localStorage.getItem("tutee_graduation_year");
          const pr = window.localStorage.getItem("tutee_pronouns");
          const subsRaw = window.localStorage.getItem("tutee_subjects");
          if (gy && gy.trim()) body.graduation_year = Number(gy);
          if (pr && pr.trim()) body.pronouns = pr;
          if (subsRaw) {
            try {
              const arr = JSON.parse(subsRaw);
              if (Array.isArray(arr)) body.subjects = arr;
            } catch {}
          }
        } catch {}
      }
      await fetch(`${apiBase}/api/account/ensure`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        credentials: "include",
      });
    } catch (e) {
      console.error("Error ensuring account via backend:", e);
    }
  };

  // Initialize auth state - only get the initial session, no listeners
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);

      try {
        // Clean up any stale Supabase auth storage entries that can cause JSON parse errors
        if (typeof window !== "undefined") {
          try {
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
            const refMatch = url.match(/https?:\/\/([^.]+)\.supabase\.co/i);
            const projectRef = refMatch ? refMatch[1] : undefined;
            const candidateKeys = [
              "supabase.auth.token",
              projectRef ? `sb-${projectRef}-auth-token` : undefined,
            ].filter(Boolean) as string[];
            for (const key of candidateKeys) {
              const raw = window.localStorage.getItem(key);
              if (!raw) continue;
              const looksJson = raw.trim().startsWith("{");
              const looksBase64 = raw.startsWith("base64-");
              if (!looksJson || looksBase64) {
                window.localStorage.removeItem(key);
              } else {
                try {
                  JSON.parse(raw);
                } catch {
                  window.localStorage.removeItem(key);
                }
              }
            }
          } catch {}
        }

        // Get current session
        const { session: currentSession } = await getSession();
        setSession(currentSession);

        // Get current user
        if (currentSession) {
          const { user: currentUser } = await getCurrentUser();
          setUser(currentUser);

          // Determine role via backend, and ensure account if pending
          const token = currentSession?.access_token || null;
          let role = await determineUserRole(token);
          if (!role && token) {
            let pendingType: "tutor" | "tutee" | null = null;
            let firstName: string | undefined;
            let lastName: string | undefined;
            let schoolId: string | undefined;
            if (typeof window !== "undefined") {
              pendingType = localStorage.getItem("signup_account_type") as
                | "tutor"
                | "tutee"
                | null;
              firstName =
                localStorage.getItem("signup_first_name") || undefined;
              lastName = localStorage.getItem("signup_last_name") || undefined;
              schoolId = localStorage.getItem("signup_school_id") || undefined;
            }
            // Fall back to metadata if local storage not present
            if (!pendingType && currentUser?.user_metadata?.account_type) {
              const metaType = String(currentUser.user_metadata.account_type);
              if (metaType === "tutor" || metaType === "tutee")
                pendingType = metaType;
              firstName = firstName || currentUser.user_metadata.first_name;
              lastName = lastName || currentUser.user_metadata.last_name;
              schoolId = schoolId || currentUser.user_metadata.school_id;
            }
            if (pendingType) {
              await ensureBackendAccount(
                token,
                pendingType,
                firstName,
                lastName,
                schoolId
              );
              if (typeof window !== "undefined") {
                localStorage.removeItem("signup_account_type");
                localStorage.removeItem("signup_first_name");
                localStorage.removeItem("signup_last_name");
                localStorage.removeItem("signup_school_id");
                // keep tutee extras keys for this ensure; they can be left or cleared later as needed
              }
              role = await determineUserRole(token);
            }
          }
          setUserRole(role);
        }
      } catch (error) {
        console.error("Auth context: Error initializing auth state:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Sign in function
  const signIn = async (email: string, password: string) => {
    console.log("Auth context: Starting sign in...", { email });

    try {
      console.log("Auth context: Calling supabase.auth.signInWithPassword...");

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log("Auth context: Sign in response received:", {
        hasData: !!data,
        hasUser: !!data?.user,
        hasSession: !!data?.session,
        error: error?.message || "No error",
      });

      if (!error && data.user) {
        console.log("Auth context: Setting user and session...");
        setUser(data.user);
        setSession(data.session);

        // Determine role via backend and ensure account if pending
        console.log("Auth context: Determining user role...");
        try {
          const token = data.session?.access_token || null;
          if (token && typeof window !== "undefined") {
            const pendingType = localStorage.getItem("signup_account_type") as
              | "tutor"
              | "tutee"
              | null;
            const firstName =
              localStorage.getItem("signup_first_name") || undefined;
            const lastName =
              localStorage.getItem("signup_last_name") || undefined;
            const schoolId =
              localStorage.getItem("signup_school_id") || undefined;
            if (pendingType) {
              await ensureBackendAccount(
                token,
                pendingType,
                firstName,
                lastName,
                schoolId
              );
              localStorage.removeItem("signup_account_type");
              localStorage.removeItem("signup_first_name");
              localStorage.removeItem("signup_last_name");
              localStorage.removeItem("signup_school_id");
            }
            const role = await determineUserRole(token);
            console.log("Auth context: User role determined:", role);
            setUserRole(role);
          } else {
            setUserRole(null);
          }
        } catch (err) {
          console.error("Auth context: Error determining role:", err);
          setUserRole(null);
        }
      }

      return { error };
    } catch (err) {
      console.error("Auth context: Exception during sign in:", err);
      return { error: { message: "Sign in failed with exception" } };
    }
  };

  // Sign up function
  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    schoolId?: string,
    accountType: "tutor" | "tutee" = "tutor"
  ) => {
    // Enforce HDSB email domain on signup (frontend-only restriction)
    try {
      const isHdsb = /^[^@\s]+@hdsb\.ca$/i.test((email || '').trim());
      if (!isHdsb) {
        return { error: { message: 'Please use your @hdsb.ca email address' } };
      }
    } catch {}
    // Persist intent for post-verification login flow
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("signup_account_type", accountType);
        if (firstName) localStorage.setItem("signup_first_name", firstName);
        if (lastName) localStorage.setItem("signup_last_name", lastName);
        if (schoolId)
          localStorage.setItem("signup_school_id", String(schoolId));
      }
    } catch {}

    // Sign up with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          school_id: schoolId,
          account_type: accountType,
        },
      },
    });

    // Detect duplicate registrations (Supabase returns user with empty identities when email already exists)
    if (!error && data.user && Array.isArray((data.user as any).identities) && (data.user as any).identities.length === 0) {
      return { error: { message: 'This email is already registered. Please sign in or reset your password.' } };
    }

    if (!error && data.user) {
      // Some projects have email confirmation; session may be null here.
      // If we do have a token, we can proactively ensure now; otherwise it will happen on first login
      try {
        const token = data.session?.access_token;
        if (token) {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account/ensure`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              account_type: accountType,
              first_name: firstName,
              last_name: lastName,
              school_id: schoolId,
            }),
          });
        }
      } catch (e) {
        console.error("Error ensuring account via backend (signup path):", e);
      }

      setUser(data.user);
      setSession(data.session);
    }

    return { error };
  };

  // Sign out function
  const signOut = async () => {
    console.log("Auth context: Starting sign out...");
    const { error } = await supabase.auth.signOut();
    console.log("Auth context: Sign out result:", {
      error: error?.message || "No error",
    });

    if (!error) {
      console.log("Auth context: Clearing user and session state...");
      setUser(null);
      setSession(null);
      setUserRole(null);
    }

    return { error };
  };

  // Helper functions for role checking
  const isAdmin = () => {
    return userRole === "admin";
  };

  const isSuperAdmin = () => {
    return userRole === "admin"; // unified
  };

  // Auth context value
  const value = {
    user,
    session,
    isLoading,
    userRole,
    signIn,
    signUp,
    signOut,
    isAdmin,
    isSuperAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

// Provider wrapper for the app
export default function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
