"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { homeFor } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordInput } from "@/components/password-input";

const GENERIC_ERROR = "Invalid email or password.";

export function LoginForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Set when the account exists but the email is unconfirmed — surfaces a Resend CTA. */
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">(
    "idle"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUnconfirmed(false);
    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      if (signInError.code === "email_not_confirmed") {
        setUnconfirmed(true);
        setError("Please verify your email first.");
      } else {
        setError(GENERIC_ERROR);
      }
      setSubmitting(false);
      return;
    }

    // Resolve the real destination from DB-fresh truth, not JWT claims.
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("me failed");
      const { profile } = (await res.json()) as {
        profile: { kind: "member" | "manager" | "admin"; status: string };
      };

      // Admins never sign in here — bounce them with the generic error.
      if (profile.kind === "admin") {
        await supabase.auth.signOut();
        setError(GENERIC_ERROR);
        setSubmitting(false);
        return;
      }

      const dest = homeFor(profile);
      router.replace(dest);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResendState("sending");
    await supabase.auth.resend({ type: "signup", email: email.trim() });
    // Cosmetic confirmation only — Supabase rate-limits resends server-side.
    setResendState("sent");
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/auth/forgot-password"
            className="text-sm font-medium text-blue-600 underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="space-y-2">
            <span>{error}</span>
            {unconfirmed ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResend}
                disabled={resendState !== "idle"}
              >
                {resendState === "sent"
                  ? "Verification email sent"
                  : resendState === "sending"
                    ? "Sending…"
                    : "Resend verification email"}
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Signing in…" : "Log in"}
      </Button>
    </form>
  );
}
