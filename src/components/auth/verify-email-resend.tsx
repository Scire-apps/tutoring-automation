"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const COOLDOWN_SECONDS = 60;

/**
 * Resends the signup confirmation email with a cosmetic 60s cooldown. Supabase
 * enforces the real rate limit server-side; the timer just prevents button-mashing.
 */
export function VerifyEmailResend({ email }: { email: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!email) {
    return (
      <p className="text-sm text-gray-500">
        Didn&apos;t get the email? Sign in to resend it.
      </p>
    );
  }

  async function handleResend() {
    if (!email) return;
    setSending(true);
    await supabase.auth.resend({ type: "signup", email });
    setSending(false);
    setCooldown(COOLDOWN_SECONDS);
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleResend}
        disabled={sending || cooldown > 0}
      >
        {cooldown > 0
          ? `Resend available in ${cooldown}s`
          : sending
            ? "Sending…"
            : "Resend verification email"}
      </Button>
    </div>
  );
}
