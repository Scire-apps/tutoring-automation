"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { sessionStart } from "@/services/api/admin";
import { BrandMark } from "@/components/brand";
import { PageBackdrop } from "@/components/page-backdrop";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The single generic failure copy — identical for EVERY failure mode (§6.1). */
const GENERIC_ERROR = "Invalid email or password.";
/** TOTP-step copy for a bad code. */
const BAD_CODE = "Invalid code.";

type Step = "credentials" | "totp";

/**
 * `/admin-login` form (§6.1). Client-direct `signInWithPassword` (GoTrue's
 * per-IP rate limiting suffices — no app-side limiter; proxying would hide it).
 *
 * Flow:
 *   1. Sign in. ANY auth error → GENERIC_ERROR.
 *   2. Self-route on the assurance level (NOT a /api/auth/me round-trip — the
 *      §6.1-literal mfa.getAuthenticatorAssuranceLevel() check). currentLevel
 *      aal1 with nextLevel aal2 ⇒ a verified TOTP factor exists ⇒ TOTP step.
 *   3. Otherwise confirm this is actually an active admin via /api/auth/me; a
 *      non-admin (or non-active) success → signOut() + GENERIC_ERROR (no
 *      enumeration — every failure looks identical).
 *   4. TOTP step: mfa.challenge + mfa.verify; a bad code → BAD_CODE (stays on the
 *      step). On success → session-start audit → /admin/dashboard.
 *
 * NO "admin" wording, no links in or out, no forgot-password (§6.1).
 */
export function AdminLoginForm() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // The TOTP factor id to challenge (set when the aal1→aal2 gap is detected).
  const factorIdRef = useRef<string | null>(null);

  // Guard so the success routing fires once.
  const routedRef = useRef(false);

  // If an admin somehow lands here already fully signed in at aal2, self-route.
  useEffect(() => {
    let ignore = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session || ignore) return;
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") {
        await completeAdmin();
      }
    })();
    return () => {
      ignore = true;
    };
    // completeAdmin closes over stable refs/router; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Finalize an authenticated, sufficiently-assured admin: audit + route. */
  async function completeAdmin() {
    if (routedRef.current) return;
    // Confirm this really is an active admin (defense-in-depth; the API also gates).
    const verified = await isActiveAdmin();
    if (!verified) {
      await supabase.auth.signOut();
      setStep("credentials");
      setError(GENERIC_ERROR);
      return;
    }
    routedRef.current = true;
    try {
      await sessionStart();
    } catch {
      // The audit write is best-effort UX — never block the admin's entry on it.
    }
    router.replace("/admin/dashboard");
  }

  /** True only for an active admin (reads /api/auth/me with the fresh token). */
  async function isActiveAdmin(): Promise<boolean> {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return false;
      const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return false;
      const body = (await res.json()) as { profile?: { kind?: string; status?: string } };
      return body.profile?.kind === "admin" && body.profile?.status === "active";
    } catch {
      return false;
    }
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setLoading(false);
      setError(GENERIC_ERROR);
      return;
    }

    // Self-route on assurance (§6.1): aal1 + nextLevel aal2 ⇒ TOTP required.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsTotp = aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2";

    if (needsTotp) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = (factors?.totp ?? []).find((f) => f.status === "verified");
      if (!totp) {
        // nextLevel says aal2 but no verified factor surfaced — treat as a failure.
        await supabase.auth.signOut();
        setLoading(false);
        setError(GENERIC_ERROR);
        return;
      }
      factorIdRef.current = totp.id;
      setLoading(false);
      setStep("totp");
      return;
    }

    // No TOTP needed: confirm admin + route (a non-admin signOut()s with GENERIC_ERROR).
    await completeAdmin();
    setLoading(false);
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    const factorId = factorIdRef.current;
    if (!factorId) {
      setError(GENERIC_ERROR);
      return;
    }
    setError(null);
    setLoading(true);

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setLoading(false);
      setError(BAD_CODE);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) {
      setLoading(false);
      setError(BAD_CODE);
      return;
    }

    await completeAdmin();
    setLoading(false);
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <PageBackdrop />
      <Card className="w-full max-w-sm shadow-xl">
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <BrandMark size={40} />
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Sign in</h1>
          </div>

          {step === "credentials" ? (
            <form className="space-y-4" onSubmit={handleCredentials}>
              <div className="space-y-1.5">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={error ? true : undefined}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-password">Password</Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className="pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={error ? true : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleTotp}>
              <div className="space-y-1.5">
                <Label htmlFor="admin-totp">Authentication code</Label>
                <Input
                  id="admin-totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  aria-invalid={error ? true : undefined}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code from your authenticator app.
                </p>
              </div>

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={loading || code.length < 6}>
                {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {loading ? "Verifying…" : "Verify"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
