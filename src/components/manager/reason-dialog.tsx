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

/**
 * A shadcn-Dialog with a single REQUIRED free-text reason — the manager-panel
 * replacement for `prompt()` behind every reason-bearing intervention (§5.8 cancel
 * / reopen / request-changes, §5.6 reject-with-note). The submit button stays
 * disabled until the reason meets `minLength`; the dialog shows a pending state and
 * stays open if `onSubmit` throws, so a failed mutation never silently dismisses.
 *
 * Controlled via `open`/`onOpenChange`. Re-mounts its form on each open (Radix
 * unmounts content on close) so the textarea seeds empty without a sync effect.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label = "Reason",
  placeholder,
  confirmLabel = "Confirm",
  destructive = false,
  required = true,
  minLength = 1,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** When false the reason is optional and an empty submit passes `""`. */
  required?: boolean;
  minLength?: number;
  /** Runs with the trimmed reason. If it rejects, the dialog stays open. */
  onSubmit: (reason: string) => Promise<void> | void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <ReasonForm
          title={title}
          description={description}
          label={label}
          placeholder={placeholder}
          confirmLabel={confirmLabel}
          destructive={destructive}
          required={required}
          minLength={minLength}
          onClose={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

function ReasonForm({
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  destructive,
  required,
  minLength,
  onClose,
  onSubmit,
}: {
  title: string;
  description?: React.ReactNode;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  destructive: boolean;
  required: boolean;
  minLength: number;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void> | void;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = reason.trim();
  const valid = required ? trimmed.length >= minLength : true;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setPending(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description ? (
          <DialogDescription asChild>
            <div>{description}</div>
          </DialogDescription>
        ) : null}
      </DialogHeader>

      <div className="space-y-2 py-3">
        <Label htmlFor="reason-field">
          {label}
          {required ? null : <span className="ml-1 text-muted-foreground">(optional)</span>}
        </Label>
        <textarea
          id="reason-field"
          rows={3}
          autoFocus
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          placeholder={placeholder}
          value={reason}
          disabled={pending}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={error ? true : undefined}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending || !valid}>
          {pending ? "Working…" : confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
