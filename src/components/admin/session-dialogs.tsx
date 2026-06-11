"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { subjectLabel, personName, type AdminSession } from "@/services/api/admin";

const HOURS_MIN = 0.25;
const HOURS_MAX = 24;
const HOURS_STEP = 0.25;

/** Suggested award = duration_minutes / 60, clamped to [0.25, 24] and rounded to 0.25. */
function suggestedHours(durationMinutes: number | null): number {
  const raw = (durationMinutes ?? 60) / 60;
  const rounded = Math.round(raw / HOURS_STEP) * HOURS_STEP;
  return Math.min(HOURS_MAX, Math.max(HOURS_MIN, Number(rounded.toFixed(2))));
}

/**
 * Admin Verify dialog (§6.3) — the same shape as the manager verify (summary +
 * recording link + decimal hours PRE-FILLED from duration, step 0.25, min 0.25,
 * max 24 + optional note), but posts `{awarded_hours, note}` to the admin verify
 * endpoint (org check bypassed). A 409 race surfaces via the caller's catch.
 */
export function AdminVerifyDialog({
  session,
  open,
  onOpenChange,
  onVerify,
}: {
  session: AdminSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerify: (input: { awarded_hours: number; note?: string | null }) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {session ? (
          <VerifyForm session={session} onClose={() => onOpenChange(false)} onVerify={onVerify} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function VerifyForm({
  session,
  onClose,
  onVerify,
}: {
  session: AdminSession;
  onClose: () => void;
  onVerify: (input: { awarded_hours: number; note?: string | null }) => Promise<void>;
}) {
  const [hours, setHours] = useState<string>(String(suggestedHours(session.duration_minutes)));
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numeric = Number(hours);
  const valid =
    Number.isFinite(numeric) &&
    numeric >= HOURS_MIN &&
    numeric <= HOURS_MAX &&
    Math.abs(numeric / HOURS_STEP - Math.round(numeric / HOURS_STEP)) < 1e-9;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError(`Hours must be a multiple of ${HOURS_STEP} between ${HOURS_MIN} and ${HOURS_MAX}.`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onVerify({ awarded_hours: numeric, note: note.trim() || null });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle className="font-display tracking-tight">Verify session</DialogTitle>
        <DialogDescription>
          Confirm the session happened and award volunteer hours to the tutor. This is final —
          corrections are made later as ledger adjustments.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-3">
        <dl className="space-y-1 rounded-md bg-muted/40 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Subject</dt>
            <dd className="text-right font-medium">{subjectLabel(session.subject)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Tutor</dt>
            <dd className="text-right font-medium">{personName(session.tutor)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Duration</dt>
            <dd className="text-right font-medium">
              {session.duration_minutes != null ? `${session.duration_minutes} min` : "—"}
            </dd>
          </div>
        </dl>

        {session.recording_url ? (
          <a
            href={session.recording_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Open recording in a new tab
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">No recording link on file.</p>
        )}

        <div className="space-y-2">
          <Label htmlFor="admin-verify-hours">Volunteer hours</Label>
          <Input
            id="admin-verify-hours"
            type="number"
            inputMode="decimal"
            step={HOURS_STEP}
            min={HOURS_MIN}
            max={HOURS_MAX}
            value={hours}
            disabled={pending}
            onChange={(e) => setHours(e.target.value)}
            aria-invalid={error ? true : undefined}
          />
          <p className="text-xs text-muted-foreground">
            Pre-filled from the session duration. Steps of {HOURS_STEP}h, {HOURS_MIN}–{HOURS_MAX}h.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="admin-verify-note">
            Note <span className="text-muted-foreground">(optional)</span>
          </Label>
          <textarea
            id="admin-verify-note"
            rows={2}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            placeholder="Anything to note about this session"
            value={note}
            disabled={pending}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !valid}>
          {pending ? "Verifying…" : "Verify & award hours"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Admin Cancel-session dialog (§6.3) — a single REQUIRED reason. Posts to the
 * admin cancel endpoint (both parties emailed). Pessimistic: stays open on error.
 */
export function AdminCancelSessionDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = reason.trim().length > 0;

  function reset() {
    setReason("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel. Please try again.");
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
            <DialogTitle className="font-display tracking-tight">Cancel this session</DialogTitle>
            <DialogDescription>
              Both the requester and the tutor will be emailed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-3">
            <Label htmlFor="admin-cancel-reason">Reason</Label>
            <textarea
              id="admin-cancel-reason"
              rows={3}
              autoFocus
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              placeholder="Why is this session being cancelled?"
              value={reason}
              disabled={pending}
              onChange={(e) => setReason(e.target.value)}
              aria-invalid={error ? true : undefined}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Keep session
            </Button>
            <Button type="submit" variant="destructive" disabled={pending || !valid}>
              {pending ? "Cancelling…" : "Cancel session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
