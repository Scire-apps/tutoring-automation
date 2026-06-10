"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordInput } from "@/components/password-input";

const MIN_PASSWORD = 10;

export function ResetPasswordForm() {
  const supabase = useMemo(() => getBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }
    setDone(true);
    setSubmitting(false);
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm leading-6 text-gray-600">Password updated.</p>
        <Button asChild className="w-full">
          <Link href="/auth/login">Log in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          helper={`At least ${MIN_PASSWORD} characters`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <PasswordInput
          id="confirm-password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
