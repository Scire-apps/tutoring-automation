"use client";

import { useState } from "react";
import { CalendarClock, FileText, User } from "lucide-react";

import type { ManageApprovalRequest } from "@/services/api/manage";
import { subjectLabel, personName } from "@/lib/manager-format";
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
 * Tutoring-approval Review dialog (§5.6). Shows the request (member, subject
 * triple, evidence, age) and decides it: Approve or Reject, each with an optional
 * `decision_note` → `POST /api/manage/subject-approvals/[id]/decide`. Pessimistic:
 * stays open and surfaces an inline error on failure.
 */
export function ApprovalReviewDialog({
  open,
  onOpenChange,
  request,
  onDecide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ManageApprovalRequest;
  /** Resolves with the decision. Stays open if it rejects. */
  onDecide: (input: { decision: "approve" | "reject"; note: string }) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setNote("");
    setError(null);
  }

  async function decide(decision: "approve" | "reject") {
    setPending(decision);
    setError(null);
    try {
      await onDecide({ decision, note: note.trim() });
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message || "Couldn't record the decision." : "Couldn't record the decision.");
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review approval request</DialogTitle>
          <DialogDescription>
            Decide whether to approve {personName(request.member)} to tutor this subject.
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-3 rounded-md border bg-muted/40 p-3 text-sm">
          <Row icon={User} label="Member">
            {personName(request.member)}
            {request.member?.email ? (
              <span className="text-muted-foreground"> · {request.member.email}</span>
            ) : null}
          </Row>
          <Row icon={FileText} label="Subject">
            {subjectLabel(request)}
          </Row>
          <Row icon={FileText} label="Evidence">
            {request.evidence ? (
              <span>{request.evidence}</span>
            ) : (
              <span className="text-muted-foreground">None provided</span>
            )}
          </Row>
          <Row icon={CalendarClock} label="Requested">
            {new Date(request.created_at).toLocaleString()}
          </Row>
        </dl>

        <div className="space-y-1.5">
          <Label htmlFor="decision-note">Decision note (optional)</Label>
          <textarea
            id="decision-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            disabled={busy}
            placeholder="Shared with the member with your decision."
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => decide("reject")}
            disabled={busy}
            className="text-destructive hover:text-destructive"
          >
            {pending === "reject" ? "Rejecting…" : "Reject"}
          </Button>
          <Button onClick={() => decide("approve")} disabled={busy}>
            {pending === "approve" ? "Approving…" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="text-foreground">{children}</dd>
      </div>
    </div>
  );
}
