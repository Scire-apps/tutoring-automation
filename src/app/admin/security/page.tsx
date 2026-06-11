"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Factor = { id: string; status: string; friendlyName?: string | null };

type Enrolling = {
  factorId: string;
  /** data-uri or SVG QR code from mfa.enroll. */
  qr: string;
  secret: string;
};

/**
 * Security (§6.3) — optional TOTP enrollment for the signed-in admin. TOTP is
 * NOT forced in v1 (the §6.1 challenge only fires when a verified factor exists);
 * this page lets an admin add one. Flow: `mfa.enroll` (QR + secret) → scan →
 * `mfa.challenge` + `mfa.verify` to confirm. An enrolled factor can be removed
 * with `mfa.unenroll`. All client-direct via the supabase MFA API.
 */
export default function AdminSecurityPage() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []).map((f) => ({ id: f.id, status: f.status, friendlyName: f.friendly_name })));
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async (post-await) data fetch
    void refresh();
  }, [refresh]);

  const verified = factors.find((f) => f.status === "verified") ?? null;

  async function startEnroll() {
    setError(null);
    setBusy(true);
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (enrollError || !data) {
        setError(enrollError?.message ?? "Couldn't start enrollment.");
        return;
      }
      setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolling) return;
    setError(null);
    setBusy(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrolling.factorId,
      });
      if (challengeError || !challenge) {
        setError("Couldn't verify the code. Try again.");
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrolling.factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) {
        setError("That code didn't match. Check your authenticator and try again.");
        return;
      }
      toast.success("Two-factor authentication enabled.");
      setEnrolling(null);
      setCode("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnroll() {
    if (enrolling) {
      // Drop the unverified factor so it doesn't linger.
      await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId }).catch(() => undefined);
    }
    setEnrolling(null);
    setCode("");
    setError(null);
    await refresh();
  }

  async function removeFactor(factorId: string) {
    setBusy(true);
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) {
        toast.error(unenrollError.message || "Couldn't remove the factor.");
        return;
      }
      toast.success("Two-factor authentication removed.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
          <Lock className="size-6 text-brand" aria-hidden="true" />
          Security
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a two-factor authenticator to your admin account.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-base tracking-tight">
            <ShieldCheck className="size-4 text-brand" aria-hidden="true" />
            Two-factor authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading…
            </div>
          ) : enrolling ? (
            <form className="space-y-4" onSubmit={confirmEnroll}>
              <p className="text-sm text-muted-foreground">
                Scan this QR code with your authenticator app, then enter the 6-digit code to
                confirm.
              </p>
              <div className="flex flex-col items-center gap-3">
                {/* mfa.enroll returns an SVG data-uri QR. */}
                <Image
                  src={enrolling.qr}
                  alt="TOTP QR code"
                  width={180}
                  height={180}
                  unoptimized
                  className="rounded-md border bg-card p-2"
                />
                <p className="text-center text-xs text-muted-foreground">
                  Can&apos;t scan? Enter this key manually:
                  <br />
                  <code className="font-mono text-foreground">{enrolling.secret}</code>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="totp-confirm">Authentication code</Label>
                <Input
                  id="totp-confirm"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  aria-invalid={error ? true : undefined}
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={cancelEnroll} disabled={busy}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || code.length < 6}>
                  {busy ? "Verifying…" : "Confirm & enable"}
                </Button>
              </div>
            </form>
          ) : verified ? (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="size-4 text-green-600" />
                <AlertDescription>
                  Two-factor authentication is enabled. You&apos;ll be asked for a code when you sign
                  in.
                </AlertDescription>
              </Alert>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => removeFactor(verified.id)}
              >
                Remove two-factor authentication
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Two-factor authentication is not enabled. Adding it requires a 6-digit code from an
                authenticator app each time you sign in.
              </p>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button onClick={startEnroll} disabled={busy}>
                {busy ? "Starting…" : "Enable two-factor authentication"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
