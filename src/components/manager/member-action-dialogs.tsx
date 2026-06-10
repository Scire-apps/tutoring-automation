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

/** The exact §5.5 label bound to `profiles.status_note` (member-visible). */
const NOTE_LABEL = "Note shown to the member (optional)";

type BaseProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  /** Resolves with the typed note (or empty string). Stays open if it rejects. */
  onConfirm: (note: string) => Promise<void>;
};

/** Shared multi-line note input wired to a controlled value. */
function NoteField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{NOTE_LABEL}</Label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={1000}
        disabled={disabled}
        placeholder="The member sees this on their account screen."
        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
      />
    </div>
  );
}

/**
 * Admit a pending member (§5.5). Optional note → `profiles.status_note` (cleared
 * server-side on admit, but the manager can leave a welcome note). Pessimistic:
 * the dialog stays open and surfaces the error inline if the call fails.
 */
export function AdmitDialog({ open, onOpenChange, memberName, onConfirm }: BaseProps) {
  return (
    <NoteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Admit ${memberName}?`}
      description="They gain full access: requesting and giving tutoring (for approved subjects)."
      confirmLabel="Admit member"
      onConfirm={onConfirm}
      showNote
    />
  );
}

/**
 * Reject a pending member (§5.5). The note binds to the member-visible
 * `status_note` on their gate card. The account + auth user are RETAINED
 * (re-admit from rejected is legal).
 */
export function RejectDialog({ open, onOpenChange, memberName, onConfirm }: BaseProps) {
  return (
    <NoteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Reject ${memberName}?`}
      description="They keep their account but stay inactive. You can admit them later."
      confirmLabel="Reject member"
      destructive
      onConfirm={onConfirm}
      showNote
    />
  );
}

/**
 * Restore a suspended/rejected member to active (§5.5). No note (status_note
 * clears on restore). Simple confirm.
 */
export function RestoreDialog({ open, onOpenChange, memberName, onConfirm }: BaseProps) {
  return (
    <NoteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Restore ${memberName}?`}
      description="Their access is reinstated immediately."
      confirmLabel="Restore member"
      onConfirm={onConfirm}
    />
  );
}

/** Generic note/confirm dialog (with optional status_note field). */
function NoteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  showNote = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  showNote?: boolean;
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
          <NoteField id="member-action-note" value={note} onChange={setNote} disabled={pending} />
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
 * Suspend a member (§5.5). Lists the member's open requests + active sessions and
 * offers an "Also cancel these now" checkbox (DEFAULT ON) that bulk-cancels them
 * server-side (open → cancelled, active → released) with counterpart emails. The
 * note binds to the member-visible `status_note`.
 */
export function SuspendDialog({
  open,
  onOpenChange,
  memberName,
  openRequests,
  activeSessions,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  /** Count of the member's open tutoring requests (cancelled if checked). */
  openRequests: number;
  /** Count of the member's in-flight sessions (released if checked). */
  activeSessions: number;
  /** Resolves with the note + whether to cascade-cancel. Stays open if it rejects. */
  onConfirm: (input: { note: string; cancelActive: boolean }) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [cancelActive, setCancelActive] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasWork = openRequests > 0 || activeSessions > 0;

  function reset() {
    setNote("");
    setCancelActive(true);
    setError(null);
  }

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm({ note: note.trim(), cancelActive });
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message || "Couldn't suspend." : "Couldn't suspend.");
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
          <DialogTitle>Suspend {memberName}?</DialogTitle>
          <DialogDescription>
            They lose access until restored. Their account and history are kept.
          </DialogDescription>
        </DialogHeader>

        {hasWork ? (
          <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium text-foreground">This member currently has:</p>
            <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
              {openRequests > 0 ? (
                <li>
                  {openRequests} open {openRequests === 1 ? "request" : "requests"}
                </li>
              ) : null}
              {activeSessions > 0 ? (
                <li>
                  {activeSessions} active {activeSessions === 1 ? "session" : "sessions"}
                </li>
              ) : null}
            </ul>
            <label className="flex cursor-pointer items-start gap-2 pt-1 text-foreground">
              <input
                type="checkbox"
                checked={cancelActive}
                onChange={(e) => setCancelActive(e.target.checked)}
                disabled={pending}
                className="mt-0.5 size-4 rounded border-input"
              />
              <span>
                Also cancel these now
                <span className="block text-xs text-muted-foreground">
                  Open requests are cancelled; active sessions go back on the board. Both
                  parties are emailed.
                </span>
              </span>
            </label>
          </div>
        ) : null}

        <NoteField id="suspend-note" value={note} onChange={setNote} disabled={pending} />

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={pending}>
            {pending ? "Suspending…" : "Suspend member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
