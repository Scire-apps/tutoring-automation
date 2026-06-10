"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, History, Plus } from "lucide-react";

import type { ManageMemberApproval, AuditEntry } from "@/services/api/manage";
import {
  getMemberApprovals,
  getMemberApprovalHistory,
  grantSubject,
  revokeApproval,
} from "@/services/api/manage";
import { ApiError } from "@/services/api";
import { GrantSubjectDialog } from "@/components/manager/grant-subject-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { subjectLabel, approvalStatusLabel, auditLine } from "@/lib/manager-format";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Member detail → Approvals tab (§5.5). Renders the member's current/decided
 * grants (subject, since, granted-by, source chip request|direct) with a Revoke
 * confirm on approved rows and a "Grant subject" picker; the per-subject decision
 * HISTORY renders below from the audit timeline.
 */
export function MemberApprovalsTab({
  memberId,
  memberName,
  onChanged,
}: {
  memberId: string;
  memberName: string;
  onChanged: () => Promise<void>;
}) {
  const [approvals, setApprovals] = useState<ManageMemberApproval[]>([]);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [grantOpen, setGrantOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ManageMemberApproval | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, h] = await Promise.all([
        getMemberApprovals(memberId),
        getMemberApprovalHistory(memberId),
      ]);
      setApprovals(a);
      setHistory(h);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message || "Couldn't load approvals." : "Couldn't load approvals.",
      );
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async (post-await) data fetch
    void load();
  }, [load]);

  const afterMutation = useCallback(async () => {
    await Promise.all([load(), onChanged()]);
  }, [load, onChanged]);

  // Subjects the member already has a live (pending/approved) row for — excluded
  // from the grant picker so a duplicate isn't attempted.
  const excludeSubjectIds = approvals
    .filter((a) => a.status === "pending" || a.status === "approved")
    .map((a) => a.org_subject_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Subject approvals</h2>
        <Button size="sm" onClick={() => setGrantOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Grant subject
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading && approvals.length === 0 ? (
        <SkeletonList />
      ) : approvals.length === 0 ? (
        <Card className="py-8 text-center">
          <CardContent className="flex flex-col items-center gap-2">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <BadgeCheck className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm text-muted-foreground">
              {memberName} has no subject approvals yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {approvals.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{subjectLabel(a)}</p>
                  <SourceChip direct={a.direct_grant} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {a.decided_at
                    ? `${approvalStatusLabel(a.status)} ${new Date(a.decided_at).toLocaleDateString()}`
                    : approvalStatusLabel(a.status)}
                  {a.decided_by_name ? ` · by ${a.decided_by_name}` : ""}
                </p>
                {a.evidence ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    Evidence: {a.evidence}
                  </p>
                ) : null}
                {a.decision_note ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">Note: {a.decision_note}</p>
                ) : null}
              </div>
              <ApprovalStatusBadge status={a.status} />
              {a.status === "approved" ? (
                <Button variant="outline" size="sm" onClick={() => setRevokeTarget(a)}>
                  Revoke
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {/* History from the audit timeline */}
      {history.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">History</h3>
          <Card>
            <CardContent className="py-2">
              <ul className="divide-y">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 py-2.5">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <History className="size-3" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{auditLine(entry)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* Grant subject picker */}
      <GrantSubjectDialog
        open={grantOpen}
        onOpenChange={setGrantOpen}
        memberName={memberName}
        excludeSubjectIds={excludeSubjectIds}
        onConfirm={async (orgSubjectId) => {
          await grantSubject({ member_id: memberId, subject_id: orgSubjectId });
          await afterMutation();
        }}
      />

      {/* Revoke confirm */}
      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        title="Revoke this approval?"
        description={
          revokeTarget
            ? `${memberName} will no longer be able to tutor ${subjectLabel(revokeTarget)}. Existing sessions are unaffected.`
            : undefined
        }
        confirmLabel="Revoke approval"
        cancelLabel="Keep it"
        destructive
        onConfirm={async () => {
          if (!revokeTarget) return;
          await revokeApproval(revokeTarget.id);
          setRevokeTarget(null);
          await afterMutation();
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------- Primitives --- */

function SourceChip({ direct }: { direct: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        direct
          ? "bg-purple-50 text-purple-700 ring-purple-600/20"
          : "bg-blue-50 text-blue-700 ring-blue-600/20",
      )}
    >
      {direct ? "Direct" : "Request"}
    </span>
  );
}

function ApprovalStatusBadge({ status }: { status: ManageMemberApproval["status"] }) {
  const tone =
    status === "approved"
      ? "bg-green-50 text-green-700 ring-green-600/20"
      : status === "pending"
        ? "bg-amber-50 text-amber-700 ring-amber-600/20"
        : status === "revoked" || status === "rejected"
          ? "bg-red-50 text-red-700 ring-red-600/20"
          : "bg-muted text-muted-foreground ring-border";
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tone,
      )}
    >
      {approvalStatusLabel(status)}
    </span>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {[0, 1].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg border bg-muted/40" />
      ))}
    </div>
  );
}
