"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

/** Shared multi-line note input (binds to the member-visible status_note). */
function NoteField({
  id,
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={1000}
        disabled={disabled}
        placeholder={placeholder}
        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
      />
    </div>
  );
}

/**
 * A generic confirm/note dialog for the admin account actions (admit/approve/
 * reject/suspend/restore/delete). Pessimistic: stays open and shows the error
 * inline if `onConfirm` rejects. `note` is passed only when `showNote` is set.
 */
export function AccountActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  showNote = false,
  noteLabel = "Note shown to the person (optional)",
  notePlaceholder = "They see this on their account screen.",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  showNote?: boolean;
  noteLabel?: string;
  notePlaceholder?: string;
  /** Resolves with the trimmed note (or ""). Stays open if it rejects. */
  onConfirm: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setNote("");
    setError(null);
  }

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm(note.trim());
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message || "Action failed." : "Action failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {showNote ? (
          <NoteField
            id="account-action-note"
            label={noteLabel}
            value={note}
            onChange={setNote}
            disabled={pending}
            placeholder={notePlaceholder}
          />
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hours-adjustment dialog (admin override of the manager power). A signed,
 * NONZERO hours value (negative = correction) + a REQUIRED reason. Mirrors the
 * manager hours-adjustment dialog.
 */
export function AdjustHoursDialog({
  open,
  onOpenChange,
  personName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personName: string;
  onConfirm: (input: { delta_hours: number; note: string }) => Promise<void>;
}) {
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numeric = Number(hours);
  const hoursValid =
    hours.trim() !== "" &&
    Number.isFinite(numeric) &&
    numeric !== 0 &&
    Math.abs(numeric) <= 24 &&
    Math.abs(numeric / 0.25 - Math.round(numeric / 0.25)) < 1e-9;
  const valid = hoursValid && note.trim().length > 0;

  function reset() {
    setHours("");
    setNote("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm({ delta_hours: numeric, note: note.trim() });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message || "Couldn't add the adjustment." : "Couldn't add the adjustment.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Adjust hours for {personName}</DialogTitle>
            <DialogDescription>
              Add a signed correction to the ledger. Use a negative value to remove hours. Ledger
              rows are never edited — this appends a new entry.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="adjust-hours">Hours (±)</Label>
              <Input
                id="adjust-hours"
                type="number"
                inputMode="decimal"
                step={0.25}
                min={-24}
                max={24}
                placeholder="e.g. -0.5"
                value={hours}
                disabled={pending}
                onChange={(e) => setHours(e.target.value)}
                aria-invalid={hours.trim() !== "" && !hoursValid ? true : undefined}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Nonzero, multiples of 0.25, between -24 and 24.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adjust-note">Reason</Label>
              <textarea
                id="adjust-note"
                rows={3}
                value={note}
                disabled={pending}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why is this adjustment being made?"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !valid}>
              {pending ? "Saving…" : "Add adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Invite-manager dialog (§6.3) — email + first/last name + (optionally) an org.
 * Used both on the global Managers page (org picker shown) and on an org detail's
 * Managers tab (org fixed). A 409 surfaces the delete-then-invite guidance.
 */
export function InviteManagerDialog({
  open,
  onOpenChange,
  orgOptions,
  fixedOrgId,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Active orgs to pick from (omitted/ignored when `fixedOrgId` is set). */
  orgOptions?: { id: string; name: string }[];
  /** When set, the invite targets this org and no picker is shown. */
  fixedOrgId?: string;
  onConfirm: (input: {
    email: string;
    first_name: string;
    last_name: string;
    org_id: string;
  }) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [orgId, setOrgId] = useState(fixedOrgId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setEmail("");
    setFirstName("");
    setLastName("");
    setOrgId(fixedOrgId ?? "");
    setError(null);
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const valid =
    emailValid && firstName.trim().length > 0 && lastName.trim().length > 0 && orgId.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm({
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        org_id: orgId,
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      const e2 = err as { status?: number; message?: string };
      if (e2.status === 409) {
        setError(
          "This email belongs to a pending/rejected member account — delete it first, then invite.",
        );
      } else {
        setError(e2.message || "Couldn't send the invitation.");
      }
    } finally {
      setPending(false);
    }
  }

  // Import the Select primitive lazily-friendly (top-level import below).
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite a manager</DialogTitle>
            <DialogDescription>
              They receive an email to set a password. Their manager account is activated on
              acceptance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-first">First name</Label>
                <Input
                  id="invite-first"
                  value={firstName}
                  disabled={pending}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-last">Last name</Label>
                <Input
                  id="invite-last"
                  value={lastName}
                  disabled={pending}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                disabled={pending}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={email.trim() !== "" && !emailValid ? true : undefined}
              />
            </div>

            {!fixedOrgId ? (
              <div className="space-y-1.5">
                <Label htmlFor="invite-org">Organization</Label>
                <OrgSelect
                  value={orgId}
                  options={orgOptions ?? []}
                  disabled={pending}
                  onChange={setOrgId}
                />
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !valid}>
              {pending ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Native select for the org picker (avoids Radix Select-inside-Dialog focus quirks). */
function OrgSelect({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: { id: string; name: string }[];
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <select
      id="invite-org"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
    >
      <option value="" disabled>
        Select an organization
      </option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
