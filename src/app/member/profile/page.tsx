"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, UserCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/app/providers";
import type { AuthProfile } from "@/app/providers";
import { supabase } from "@/lib/supabase/client";
import { ApiError } from "@/services/api";
import { updateProfile } from "@/services/api/member";

const PASSWORD_MIN = 10;
const GRADE_NONE = "__none__";
const GRADES = [9, 10, 11, 12] as const;

export default function MemberProfilePage() {
  const { user, profile, refreshProfile } = useAuth();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">

      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold tracking-tight">
        <UserCircle className="size-6 text-blue-600" aria-hidden="true" />
        Profile
      </h1>

      {/* Keyed on the profile id so the form remounts (and re-seeds its fields)
          once identity loads — no post-mount setState. */}
      {profile ? (
        <DetailsForm
          key={profile.id}
          profile={profile}
          email={user?.email ?? ""}
          onSaved={refreshProfile}
        />
      ) : (
        <Card className="mb-8">
          <CardContent className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading…
          </CardContent>
        </Card>
      )}

      <PasswordForm />
    </div>
  );
}

// --- Account details ---------------------------------------------------------

function DetailsForm({
  profile,
  email,
  onSaved,
}: {
  profile: AuthProfile;
  email: string;
  onSaved: () => Promise<unknown>;
}) {
  const [firstName, setFirstName] = useState(profile.first_name ?? "");
  const [lastName, setLastName] = useState(profile.last_name ?? "");
  const [grade, setGrade] = useState<string>(
    profile.grade != null ? String(profile.grade) : GRADE_NONE,
  );
  const [pronouns, setPronouns] = useState(profile.pronouns ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First and last name are required.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        grade: grade === GRADE_NONE ? null : Number(grade),
        pronouns: pronouns.trim() || null,
      });
      await onSaved();
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message || "Could not save your profile."
          : "Could not save your profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-base">Your details</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first-name">First name</Label>
              <Input
                id="first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last-name">Last name</Label>
              <Input
                id="last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="grade">Grade (optional)</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger id="grade" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GRADE_NONE}>Not specified</SelectItem>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={String(g)}>
                      Grade {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pronouns">Pronouns (optional)</Label>
              <Input
                id="pronouns"
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value)}
                placeholder="e.g. she/her"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org">Organization</Label>
              <Input id="org" value={profile.org?.name ?? ""} readOnly disabled />
            </div>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// --- Password ----------------------------------------------------------------

function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < PASSWORD_MIN) {
      setError(`Password must be at least ${PASSWORD_MIN} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setPassword("");
      setConfirm("");
      toast.success("Password updated.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Change password</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">At least {PASSWORD_MIN} characters.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={saving || !password || !confirm}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Updating…
              </>
            ) : (
              "Update password"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
