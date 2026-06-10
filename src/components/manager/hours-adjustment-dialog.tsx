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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * "Add adjustment" dialog (§5.5 / §5.10): a SIGNED, NONZERO hours delta with a
 * REQUIRED reason. Negative deltas are corrections (the append-only ledger is
 * never edited; awards come only from the verify trigger). Validates ±0.25-step,
 * nonzero, |delta| ≤ 24 client-side; the server CHECK is authoritative.
 */
export function HoursAdjustmentDialog({
  open,
  onOpenChange,
  memberName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  /** Resolves with the signed delta + reason. Stays open if it rejects. */
  onConfirm: (input: { delta_hours: number; note: string }) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setValue("");
    setNote("");
    setError(null);
  }

  function validate(): { delta: number; note: string } | null {
    const delta = Number(value);
    if (!Number.isFinite(delta) || delta === 0) {
      setError("Enter a nonzero number of hours (e.g. 1.5 or -0.5).");
      return null;
    }
    if (Math.abs(delta) > 24) {
      setError("Adjustments are capped at ±24 hours.");
      return null;
    }
    // 0.25 step.
    if (Math.round(delta * 4) !== delta * 4) {
      setError("Use 0.25-hour steps (e.g. 0.25, 0.5, 1, 1.5).");
      return null;
    }
    const reason = note.trim();
    if (reason.length === 0) {
      setError("A reason is required for every adjustment.");
      return null;
    }
    return { delta, note: reason };
  }

  async function handleConfirm() {
    const parsed = validate();
    if (!parsed) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm({ delta_hours: parsed.delta, note: parsed.note });
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message || "Couldn't save the adjustment." : "Couldn't save the adjustment.");
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
          <DialogTitle>Adjust hours for {memberName}</DialogTitle>
          <DialogDescription>
            Add a manual ledger entry. Use a negative number to correct an
            over-award. This never edits existing rows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="adjust-hours">Hours (signed)</Label>
            <Input
              id="adjust-hours"
              type="number"
              step="0.25"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 1.5 or -0.5"
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adjust-reason">Reason</Label>
            <textarea
              id="adjust-reason"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              disabled={pending}
              placeholder="Why are you adjusting these hours?"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={pending}>
            {pending ? "Saving…" : "Add adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
