"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

/** Account kind/status mirror the Scire enums (see src/types/database.ts). */
export type AccountKind = "member" | "manager" | "admin";
export type AccountStatus = "pending" | "active" | "suspended" | "rejected";

/**
 * Identity profile as served by `GET /api/auth/me` (§7.2). This is the single
 * client-side source of truth for who the user is and what state they are in;
 * the proxy's JWT claims are routing hints only and are never trusted for authz.
 */
export type AuthProfile = {
  id: string;
  kind: AccountKind;
  status: AccountStatus;
  org: { id: string; name: string } | null;
  first_name: string;
  last_name: string;
  grade?: number | null;
  pronouns?: string | null;
  status_note?: string | null;
  volunteer_hours_total?: number;
  created_at: string;
};

type SignUpArgs = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  orgId: string;
  kind?: "member" | "manager";
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: AuthProfile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
  signUp: (args: SignUpArgs) => Promise<{ error: { message: string } | null }>;
  signOut: () => Promise<{ error: { message: string } | null }>;
  /** Re-fetch the profile from /api/auth/me (admission polling, post-mutation refresh). */
  refreshProfile: () => Promise<AuthProfile | null>;
  /** Re-mint the JWT so routing-hint claims (kind/status/org_id) reflect a status flip. */
  refreshClaims: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Fetch the identity profile with the caller's bearer token. */
async function fetchMe(accessToken: string | null | undefined): Promise<AuthProfile | null> {
  if (!accessToken) return null;
  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { profile?: AuthProfile };
    return json.profile ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Latest access token, read inside async callbacks without re-subscribing.
  const tokenRef = useRef<string | null>(null);

  const refreshProfile = useCallback(async () => {
    const next = await fetchMe(tokenRef.current);
    setProfile(next);
    return next;
  }, []);

  const refreshClaims = useCallback(async () => {
    await supabase.auth.refreshSession();
  }, []);

  // Single onAuthStateChange subscription drives session + profile hydration.
  // INITIAL_SESSION fires on mount (replaces the old manual getSession bootstrap).
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      tokenRef.current = nextSession?.access_token ?? null;

      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED"
      ) {
        setProfile(await fetchMe(nextSession?.access_token));
      } else if (event === "SIGNED_OUT") {
        setProfile(null);
      }

      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? { message: error.message } : null };
  }, []);

  const signUp = useCallback(
    async ({ email, password, firstName, lastName, orgId, kind = "member" }: SignUpArgs) => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/confirm`,
          data: {
            kind,
            org_id: orgId,
            first_name: firstName,
            last_name: lastName,
          },
        },
      });
      return { error: error ? { message: error.message } : null };
    },
    []
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { error: error ? { message: error.message } : null };
  }, []);

  const value: AuthContextType = {
    user,
    session,
    profile,
    isLoading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    refreshClaims,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
