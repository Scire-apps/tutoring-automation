"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { getMe } from "@/services/api";
import { homeFor } from "@/lib/routes";
import { BRAND } from "@/lib/brand";
import { BrandMark } from "@/components/brand";
import { PageBackdrop } from "@/components/page-backdrop";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Password minimum (§3.3 / §2.9 — adopted min length 10). */
const MIN_PASSWORD = 10;

/**
 * `/auth/accept-invite` (§3.3) — the set-password page reached after an invited
 * user confirms their email (`/auth/confirm` with `type=invite` set the cookie
 * session and forwarded here; the proxy allows this path while authed). The user
 * sets a password (min 10 + confirm) via `supabase.auth.updateUser`, then is
 * routed to their canonical home (`homeFor`).
 *
 * Invite interop (§3.3): `inviteUserByEmail` set the manager metadata → the
 * provisioning trigger created a PENDING manager profile → the admin invite route
 * service-flipped it to active. So an invited manager who finishes here lands on
 * /manager/dashboard; the routing reads the live profile from /api/auth/me.
 */
export default function AcceptInvitePage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const submittingRef = useRef(false);

  // The invite link establishes a session via /auth/confirm; verify one exists.
  useEffect(() => {
    let ignore = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (ignore) return;
      setHasSession(!!data.session);
      setChecking(false);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(`Your password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      submittingRef.current = false;
      setLoading(false);
      setError(updateError.message);
      return;
    }

    // Route to the canonical home for this account's live kind/status.
    try {
      const me = await getMe();
      router.replace(
        homeFor({ user_kind: me.profile.kind, user_status: me.profile.status }),
      );
    } catch {
      // Identity fetch failed — fall back to the public landing (proxy re-routes).
      router.replace("/");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <PageBackdrop />
      <Card className="w-full max-w-sm shadow-xl">
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <BrandMark size={40} />
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Set your password
            </h1>
            <p className="text-sm text-muted-foreground">
              Choose a password to finish setting up your account.
            </p>
          </div>

          {checking ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading…
            </div>
          ) : !hasSession ? (
            <div className="space-y-2 rounded-md bg-muted p-4 text-center text-sm text-muted-foreground">
              <ShieldCheck className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
              <p>
                This invite link is invalid or has expired. Ask the Scire team to resend your
                invitation at{" "}
                <a
                  href={`mailto:${BRAND.contactEmail}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {BRAND.contactEmail}
                </a>
                .
              </p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="invite-password">New password</Label>
                <div className="relative">
                  <Input
                    id="invite-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={MIN_PASSWORD}
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
                <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD} characters.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-confirm">Confirm password</Label>
                <Input
                  id="invite-confirm"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  aria-invalid={error ? true : undefined}
                />
              </div>

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {loading ? "Saving…" : "Save password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
