"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const target = email.trim();
    // Response is always generic — never reveal whether the account exists.
    await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/auth/reset-password`,
    });
    setSentTo(target);
    setSubmitting(false);
  }

  if (sentTo) {
    return (
      <p className="text-center text-sm leading-6 text-gray-600">
        If an account exists for{" "}
        <span className="font-medium text-gray-900">{sentTo}</span>, a reset link
        is on its way.
      </p>
    );
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
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
