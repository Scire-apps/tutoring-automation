"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordInput } from "@/components/password-input";

type Org = { id: string; name: string };

const MIN_PASSWORD = 10;

export function RegisterForm({ kind }: { kind: "member" | "manager" }) {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserClient(), []);

  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [orgsFailed, setOrgsFailed] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [orgId, setOrgId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/public/orgs");
        if (!res.ok) throw new Error("orgs request failed");
        const json = (await res.json()) as { items: Org[] };
        if (active) setOrgs(json.items ?? []);
      } catch {
        if (active) setOrgsFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const canSubmit =
    !submitting &&
    !orgsFailed &&
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    orgId !== "" &&
    email.trim() !== "" &&
    password.length >= MIN_PASSWORD;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }

    setSubmitting(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        data: {
          kind,
          org_id: orgId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
      },
    });

    if (signUpError) {
      // Under enumeration protection, signUp does not error on duplicate emails;
      // a real failure here is a genuine problem worth surfacing.
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }

    const params = new URLSearchParams({ email: email.trim() });
    if (kind === "manager") params.set("kind", "manager");
    router.push(`/auth/verify-email?${params.toString()}`);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="first-name">First name</Label>
          <Input
            id="first-name"
            autoComplete="given-name"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last-name">Last name</Label>
          <Input
            id="last-name"
            autoComplete="family-name"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="organization">Organization</Label>
        <Select value={orgId} onValueChange={setOrgId} disabled={orgsFailed}>
          <SelectTrigger id="organization" className="w-full">
            <SelectValue
              placeholder={
                orgsFailed
                  ? "Couldn't load organizations"
                  : orgs === null
                    ? "Loading organizations…"
                    : "Select your organization"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {(orgs ?? []).map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Don&apos;t see your organization? Email{" "}
          <a
            href={`mailto:${BRAND.contactEmail}`}
            className="font-medium text-brand underline-offset-4 hover:underline"
          >
            {BRAND.contactEmail}
          </a>
          .
        </p>
      </div>

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
        <Label htmlFor="password">Password</Label>
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

      {orgsFailed ? (
        <Alert variant="destructive">
          <AlertDescription>
            We couldn&apos;t load the list of organizations. Refresh the page to
            try again.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" className="w-full" disabled={!canSubmit}>
        {submitting ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}
