"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase, getCurrentUser, getSession } from "@/services/supabase";

// Define user role type
type UserRole = "tutor" | "admin" | "superadmin" | null;

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
    accountType?: 'tutor' | 'tutee'
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

  // Function to determine user role
  const determineUserRole = async (userId: string): Promise<UserRole> => {
    console.log("Auth context: Determining role for user ID:", userId);

    try {
      // Check if user is an admin
      console.log("Auth context: Checking admin table...");
      const { data: adminData, error: adminError } = await supabase
        .from("admins")
        .select("role")
        .eq("auth_id", userId)
        .single();

      console.log("Auth context: Admin query result:", {
        adminData,
        adminError: adminError?.message || "none",
      });

      if (adminError && adminError.code !== "PGRST116") {
        // PGRST116 is "not found" error, which is expected for tutors
        console.error("Auth context: Error querying admin table:", adminError);
      }

      if (adminData) {
        console.log("Auth context: User is admin with role:", adminData.role);
        return adminData.role as UserRole;
      }

      // Check if user is a tutor
      console.log("Auth context: Checking tutor table...");
      const { data: tutorData, error: tutorError } = await supabase
        .from("tutors")
        .select("id")
        .eq("auth_id", userId)
        .single();

      console.log("Auth context: Tutor query result:", {
        tutorData,
        tutorError,
      });

      if (tutorData) {
        console.log("Auth context: User is tutor");
        return "tutor";
      }

      console.log("Auth context: No role found for user");
      return null;
    } catch (error) {
      console.error("Auth context: Error determining user role:", error);
      return null;
    }
  };

  // Initialize auth state - only get the initial session, no listeners
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);

      try {
        // Get current session
        const { session: currentSession } = await getSession();
        setSession(currentSession);

        // Get current user
        if (currentSession) {
          const { user: currentUser } = await getCurrentUser();
          setUser(currentUser);

          // Determine user role
          if (currentUser) {
            const role = await determineUserRole(currentUser.id);
            setUserRole(role);
          }
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

        // Determine user role synchronously to ensure proper redirect
        console.log("Auth context: Determining user role...");
        try {
          // ask backend for role
          const token = data.session?.access_token;
          let role: any = null;
          if (token) {
            const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/role`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await resp.json();
            role = json.role ?? null;
          } else {
            role = await determineUserRole(data.user.id);
          }
          console.log("Auth context: User role determined:", role);
          setUserRole(role);
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
    accountType: 'tutor' | 'tutee' = 'tutor'
  ) => {
    // Sign up with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          school_id: schoolId,
        },
      },
    });

    if (!error && data.user) {
      // Ask backend to ensure profile row (uses service role)
      try {
        const token = data.session?.access_token;
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account/ensure`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_type: accountType,
            first_name: firstName,
            last_name: lastName,
            school_id: schoolId,
          })
        });
      } catch (e) {
        console.error('Error ensuring account via backend:', e);
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
    return userRole === "admin" || userRole === "superadmin";
  };

  const isSuperAdmin = () => {
    return userRole === "superadmin";
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
