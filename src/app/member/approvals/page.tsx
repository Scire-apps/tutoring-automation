"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ApprovalStatus } from "@/types/api";
import { ApiError } from "@/services/api";
import {
  listSubjectApprovals,
  listSubjects,
  requestSubjectApproval,
  withdrawApproval,
  type MemberApproval,
  type MemberSubject,
} from "@/services/api/member";

const EVIDENCE_MIN = 3;

export default function MemberApprovalsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ApprovalsInner />
    </Suspense>
  );
}

function PageFallback() {
  return (
    <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-4 py-16 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      Loading…
    </div>
  );
}

function ApprovalsInner() {
  const preselect = useSearchParams().get("subject");

  const [catalog, setCatalog] = useState<MemberSubject[]>([]);
  const [approvals, setApprovals] = useState<MemberApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  // Bumped by mutations to refetch (event-handler setState).
  const [reloadToken, setReloadToken] = useState(0);
  // Apply the board's `?subject=` deep link only on the first successful load.
  const preselectApplied = useRef(false);

  // Loads catalog + approvals. State writes live in async continuations and a
  // cancellation flag drops a stale response if the effect re-runs.
  useEffect(() => {
    let ignore = false;
    Promise.all([listSubjects(), listSubjectApprovals()])
      .then(([cat, apps]) => {
        if (ignore) return;
        const activeCat = cat.filter((s) => s.active !== false);
        setCatalog(activeCat);
        setApprovals(apps);
        setError(null);
        if (
          !preselectApplied.current &&
          preselect &&
          isRequestable(activeCat, preselect)
        ) {
          preselectApplied.current = true;
          setSubjectId(preselect);
        }
      })
      .catch(() => {
        if (!ignore) setError("Could not load your approvals.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [preselect, reloadToken]);

  const reload = () => setReloadToken((t) => t + 1);

  // Subjects you may request: not currently approved/pending, and never revoked
  // (revoked subjects cannot be re-requested — §4.8).
  const requestable = useMemo(
    () =>
      catalog
        .filter((s) => canRequest(s.approval_status))
        .sort((a, b) => subjectLabel(a).localeCompare(subjectLabel(b))),
    [catalog],
  );

  const evidenceValid = evidence.trim().length >= EVIDENCE_MIN;
  const canSubmit = !!subjectId && evidenceValid && !submitting;

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId || !evidenceValid) return;
    setSubmitting(true);
    try {
      await requestSubjectApproval({ org_subject_id: subjectId, evidence: evidence.trim() });
      toast.success("Approval requested — a manager will review it.");
      setSubjectId(null);
      setEvidence("");
      reload();
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_state") {
        toast.error("You already have a request for that subject.");
      } else if (err instanceof ApiError) {
        toast.error(err.message || "Could not submit your request. Please try again.");
      } else {
        toast.error("Could not submit your request. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (id: string) => {
    setWithdrawingId(id);
    try {
      await withdrawApproval(id);
      toast.success("Request withdrawn.");
      reload();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message || "Could not withdraw." : "Could not withdraw.",
      );
    } finally {
      setWithdrawingId(null);
    }
  };

  // Re-request flips the same row → reuse the request form, prefilled.
  const handleReRequest = (a: MemberApproval) => {
    setSubjectId(a.org_subject_id);
    setEvidence("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">

      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
        <ShieldCheck className="size-6 text-blue-600" aria-hidden="true" />
        Subject approvals
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Request approval to tutor a subject. A manager reviews your evidence before you can
        claim requests in it.
      </p>

      {/* --- Request form --- */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Request a new approval</CardTitle>
        </CardHeader>
        <CardContent>
          {requestable.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">
              You&apos;ve requested or been approved for every subject your organization
              offers.
            </p>
          ) : (
            <form className="space-y-4" onSubmit={handleRequest}>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Select
                  value={subjectId ?? undefined}
                  onValueChange={(v) => setSubjectId(v)}
                >
                  <SelectTrigger id="subject" className="w-full">
                    <SelectValue placeholder="Choose a subject to tutor" />
                  </SelectTrigger>
                  <SelectContent>
                    {requestable.map((s) => (
                      <SelectItem key={s.org_subject_id} value={s.org_subject_id}>
                        {subjectLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="evidence">Evidence</Label>
                <textarea
                  id="evidence"
                  rows={2}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  placeholder='e.g. "97% in MHF4U", "IB 7 in Physics HL"'
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  aria-invalid={evidence.length > 0 && !evidenceValid ? true : undefined}
                />
                <p className="text-xs text-muted-foreground">
                  Show a manager why you&apos;re qualified — a grade, score, or relevant
                  experience.
                </p>
              </div>

              <Button type="submit" disabled={!canSubmit}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Submitting…
                  </>
                ) : (
                  "Request approval"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* --- My approvals --- */}
      <h2 className="mb-3 text-lg font-semibold">My approvals</h2>
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading…
        </div>
      ) : error ? (
        <p className="py-8 text-sm text-destructive">{error}</p>
      ) : approvals.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            You haven&apos;t requested any subject approvals yet.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {approvals.map((a) => (
            <ApprovalRow
              key={a.id}
              approval={a}
              withdrawing={withdrawingId === a.id}
              onWithdraw={() => handleWithdraw(a.id)}
              onReRequest={() => handleReRequest(a)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Approval row ------------------------------------------------------------

function ApprovalRow({
  approval,
  withdrawing,
  onWithdraw,
  onReRequest,
}: {
  approval: MemberApproval;
  withdrawing: boolean;
  onWithdraw: () => void;
  onReRequest: () => void;
}) {
  const { status } = approval;
  const canReRequest = status === "rejected" || status === "withdrawn";
  const canWithdraw = status === "pending";

  return (
    <li>
      <Card>
        <CardContent className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{subjectLabel(approval)}</p>
              {approval.direct_grant ? (
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <BadgeCheck className="size-3.5 text-blue-600" aria-hidden="true" />
                  Granted by a manager
                </p>
              ) : approval.evidence ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Evidence: {approval.evidence}
                </p>
              ) : null}
            </div>
            <StatusPill status={status} />
          </div>

          {/* Revoked renders like rejected — note prefixed "Revoked — …" — no re-request. */}
          {status === "revoked" && approval.decision_note ? (
            <p className="text-sm text-red-600">Revoked — {approval.decision_note}</p>
          ) : status === "rejected" && approval.decision_note ? (
            <p className="text-sm text-red-600">{approval.decision_note}</p>
          ) : null}

          {canReRequest || canWithdraw ? (
            <div className="flex justify-end gap-2 pt-1">
              {canWithdraw ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onWithdraw}
                  disabled={withdrawing}
                >
                  {withdrawing ? "Withdrawing…" : "Withdraw"}
                </Button>
              ) : null}
              {canReRequest ? (
                <Button variant="outline" size="sm" onClick={onReRequest}>
                  Request again
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
}

const PILL_STYLES: Record<ApprovalStatus, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-green-50 text-green-700 ring-green-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  withdrawn: "bg-muted text-muted-foreground ring-border",
  revoked: "bg-red-50 text-red-700 ring-red-200",
};

const PILL_LABELS: Record<ApprovalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  revoked: "Revoked",
};

function StatusPill({ status }: { status: ApprovalStatus }) {
  return (
    <span
      className={
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset " +
        PILL_STYLES[status]
      }
    >
      {PILL_LABELS[status]}
    </span>
  );
}

// --- helpers -----------------------------------------------------------------

/** Whether a member may (re-)request approval given the subject's current status. */
function canRequest(status: ApprovalStatus | null): boolean {
  return status !== "approved" && status !== "pending" && status !== "revoked";
}

function isRequestable(catalog: MemberSubject[], orgSubjectId: string): boolean {
  return catalog.some(
    (s) => s.org_subject_id === orgSubjectId && canRequest(s.approval_status),
  );
}

function subjectLabel(s: { subject_name?: string; name?: string; subject_category?: string | null; category?: string | null; subject_grade?: number | null; grade_level?: number | null }): string {
  const name = s.subject_name ?? s.name ?? "";
  const category = s.subject_category ?? s.category ?? null;
  const grade = s.subject_grade ?? s.grade_level ?? null;
  const bits = [name];
  if (category) bits.push(category);
  if (grade != null) bits.push(`Grade ${grade}`);
  return bits.filter(Boolean).join(" · ");
}
