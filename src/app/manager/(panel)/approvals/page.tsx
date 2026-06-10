"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Clock, Inbox } from "lucide-react";

import type {
  ManageApprovalRequest,
  ManageOrgSubject,
  ManageSubjectApprovedMember,
} from "@/services/api/manage";
import {
  listApprovalRequests,
  decideApproval,
  listOrgSubjects,
  listApprovedMembersForSubject,
  revokeApproval,
} from "@/services/api/manage";
import { ApiError } from "@/services/api";
import { useManagerContext } from "@/components/manager-shell";
import { ApprovalReviewDialog } from "@/components/manager/approval-review-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/manager/tabs";
import { subjectLabel, personName } from "@/lib/manager-format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Tutoring approvals (§5.6): two tabs.
 *   - Requests: pending subject_approvals (member, subject triple, evidence, age)
 *     → Review dialog → Approve | Reject with a decision_note.
 *   - By-subject: pick a subject → its approved members, each with Revoke.
 * Revoke/reject are status UPDATEs (never row deletion); the same (member,subject)
 * row flips on re-request, with per-subject history on the member detail.
 */
export default function ManagerApprovalsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tutoring approvals</h1>
        <p className="text-sm text-muted-foreground">
          Decide who can tutor which subjects.
        </p>
      </header>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="by-subject">By subject</TabsTrigger>
        </TabsList>
        <TabsContent value="requests" className="pt-4">
          <RequestsTab />
        </TabsContent>
        <TabsContent value="by-subject" className="pt-4">
          <BySubjectTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------------------------------------------------------- Requests --- */

function RequestsTab() {
  const { refreshCounts } = useManagerContext();
  const [rows, setRows] = useState<ManageApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<ManageApprovalRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listApprovalRequests({ limit: 100, offset: 0 });
      setRows(res.items);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message || "Couldn't load requests." : "Couldn't load requests.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async (post-await) data fetch
    void load();
  }, [load]);

  const afterMutation = useCallback(async () => {
    await Promise.all([load(), refreshCounts()]);
  }, [load, refreshCounts]);

  if (loading && rows.length === 0) return <SkeletonList />;

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="py-10 text-center">
        <CardContent className="flex flex-col items-center gap-2">
          <span className="flex size-11 items-center justify-center rounded-full bg-green-50 text-green-600">
            <Inbox className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm text-muted-foreground">No pending approval requests.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Clock className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 font-medium text-foreground">
                {personName(r.member)}
                <span className="text-muted-foreground">·</span>
                <span className="font-normal text-foreground">{subjectLabel(r)}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {r.evidence ? `Evidence: ${r.evidence}` : "No evidence provided"} · requested{" "}
                {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>
            <Button size="sm" onClick={() => setReviewTarget(r)}>
              Review
            </Button>
          </li>
        ))}
      </ul>

      {reviewTarget ? (
        <ApprovalReviewDialog
          open={reviewTarget !== null}
          onOpenChange={(open) => {
            if (!open) setReviewTarget(null);
          }}
          request={reviewTarget}
          onDecide={async ({ decision, note }) => {
            await decideApproval(reviewTarget.id, { decision, decision_note: note || undefined });
            setReviewTarget(null);
            await afterMutation();
          }}
        />
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------- By subject --- */

function BySubjectTab() {
  const [subjects, setSubjects] = useState<ManageOrgSubject[]>([]);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string>("");

  const [members, setMembers] = useState<ManageSubjectApprovedMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ManageSubjectApprovedMember | null>(null);

  // Load the active catalog once.
  useEffect(() => {
    let cancelled = false;
    listOrgSubjects({ active: true })
      .then((items) => {
        if (!cancelled) setSubjects(items);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setSubjectsError(
            e instanceof ApiError ? e.message || "Couldn't load subjects." : "Couldn't load subjects.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMembers = useCallback(async (id: string) => {
    setLoadingMembers(true);
    setMembersError(null);
    try {
      setMembers(await listApprovedMembersForSubject(id));
    } catch (e) {
      setMembersError(
        e instanceof ApiError ? e.message || "Couldn't load members." : "Couldn't load members.",
      );
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    // With no subject picked the render shows the prompt card (ignoring any stale
    // `members`), so nothing needs clearing synchronously here.
    if (!subjectId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async (post-await) data fetch
    void loadMembers(subjectId);
  }, [subjectId, loadMembers]);

  return (
    <div className="space-y-4">
      {subjectsError ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t load subjects</AlertTitle>
          <AlertDescription>{subjectsError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="max-w-md space-y-1.5">
        <label className="text-sm font-medium text-foreground" htmlFor="by-subject-picker">
          Subject
        </label>
        <Select value={subjectId} onValueChange={setSubjectId}>
          <SelectTrigger id="by-subject-picker" className="w-full">
            <SelectValue placeholder="Pick a subject…" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {subjectLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!subjectId ? (
        <Card className="py-10 text-center">
          <CardContent className="flex flex-col items-center gap-2">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <BadgeCheck className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm text-muted-foreground">
              Pick a subject to see who&apos;s approved to tutor it.
            </p>
          </CardContent>
        </Card>
      ) : membersError ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{membersError}</AlertDescription>
        </Alert>
      ) : loadingMembers ? (
        <SkeletonList />
      ) : members.length === 0 ? (
        <Card className="py-10 text-center">
          <CardContent>
            <p className="text-sm text-muted-foreground">No one is approved for this subject yet.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => (
            <li
              key={m.approval_id}
              className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/manager/members/${m.member_id}`}
                  className="font-medium text-foreground hover:text-blue-700 hover:underline"
                >
                  {personName(m)}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {m.email}
                  {m.decided_at ? ` · since ${new Date(m.decided_at).toLocaleDateString()}` : ""}
                  {m.direct_grant ? " · direct grant" : ""}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setRevokeTarget(m)}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        title="Revoke this approval?"
        description={
          revokeTarget
            ? `${personName(revokeTarget)} will no longer be able to tutor this subject.`
            : undefined
        }
        confirmLabel="Revoke approval"
        cancelLabel="Keep it"
        destructive
        onConfirm={async () => {
          if (!revokeTarget) return;
          await revokeApproval(revokeTarget.approval_id);
          setRevokeTarget(null);
          if (subjectId) await loadMembers(subjectId);
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------- Primitives --- */

function SkeletonList() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg border bg-muted/40" />
      ))}
    </div>
  );
}
