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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { memberName, type ManageMember } from "@/services/api/manage";

const HOURS_MAX = 24;

/**
 * Manual hours-adjustment dialog (§5.10). A signed, NONZERO hours value (negative =
 * a correction; the ledger is append-only — rows are never edited) against a chosen
 * member, with a REQUIRED reason. Submits via `onSubmit`; stays open if it throws.
 */
export function AdjustmentDialog({
  open,
  onOpenChange,
  members,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: ManageMember[];
  onSubmit: (input: { member_id: string; hours: number; note: string }) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <AdjustmentForm members={members} onClose={() => onOpenChange(false)} onSubmit={onSubmit} />
      </DialogContent>
    </Dialog>
  );
}

function AdjustmentForm({
  members,
  onClose,
  onSubmit,
}: {
  members: ManageMember[];
  onClose: () => void;
  onSubmit: (input: { member_id: string; hours: number; note: string }) => Promise<void>;
}) {
  const [memberId, setMemberId] = useState<string>("");
  const [hours, setHours] = useState<string>("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numeric = Number(hours);
  const hoursValid =
    hours.trim() !== "" &&
    Number.isFinite(numeric) &&
    numeric !== 0 &&
    Math.abs(numeric) <= HOURS_MAX;
  const noteValid = note.trim().length > 0;
  const valid = !!memberId && hoursValid && noteValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setPending(true);
    setError(null);
    try {
      await onSubmit({ member_id: memberId, hours: numeric, note: note.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the adjustment.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Adjust volunteer hours</DialogTitle>
        <DialogDescription>
          Add or remove hours for a member. Use a negative value to correct an over-award. This
          writes a new ledger entry — nothing is overwritten.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-3">
        <div className="space-y-2">
          <Label htmlFor="adjust-member">Member</Label>
          <Select value={memberId || undefined} onValueChange={setMemberId}>
            <SelectTrigger id="adjust-member" className="w-full">
              <SelectValue placeholder="Choose a member" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {memberName(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="adjust-hours">Hours (+ or −)</Label>
          <Input
            id="adjust-hours"
            type="number"
            inputMode="decimal"
            step={0.25}
            min={-HOURS_MAX}
            max={HOURS_MAX}
            placeholder="e.g. -1.5"
            value={hours}
            disabled={pending}
            onChange={(e) => setHours(e.target.value)}
            aria-invalid={hours.trim() !== "" && !hoursValid ? true : undefined}
          />
          <p className="text-xs text-muted-foreground">
            Nonzero, between −{HOURS_MAX} and {HOURS_MAX}.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="adjust-note">Reason</Label>
          <textarea
            id="adjust-note"
            rows={2}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            placeholder="Why is this adjustment being made?"
            value={note}
            disabled={pending}
            onChange={(e) => setNote(e.target.value)}
            aria-invalid={note.length > 0 && !noteValid ? true : undefined}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !valid}>
          {pending ? "Saving…" : "Record adjustment"}
        </Button>
      </DialogFooter>
    </form>
  );
}
