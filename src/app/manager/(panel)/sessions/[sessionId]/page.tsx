"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  ExternalLink,
  History,
  Loader2,
  RotateCcw,
  PencilLine,
} from "lucide-react";
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
import type { PriorityLevel } from "@/types/api";
import { ApiError } from "@/services/api";
import {
  cancelSession,
  getSessionDetail,
  reopenSession,
  requestChanges,
  setPriority,
  subjectLabel,
  verifySession,
  type ManageSessionDetail,
  type SessionTimelineEntry,
} from "@/services/api/manage";
import {
  AvailabilityView,
  SessionStatusBadge,
  formatDateTime,
  formatHours,
} from "@/components/manager/ui";
import { ReasonDialog } from "@/components/manager/reason-dialog";
import { VerifyDialog } from "@/components/manager/verify-dialog";
import { useList } from "@/components/manager/use-list";

const TERMINAL = new Set(["verified", "cancelled"]);
const REOPENABLE = new Set(["claimed", "availability_set", "scheduled"]);

type DialogKind = "cancel" | "reopen" | "request-changes" | "verify" | null;

export default function ManagerSessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [savingPriority, setSavingPriority] = useState(false);
  // Bumped after any intervention (or a 409 race) to refetch the record + timeline.
  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((t) => t + 1);

  const { data, loading, error, notFound } = useList<ManageSessionDetail>(
    () => getSessionDetail(sessionId),
    [sessionId, reloadToken],
    "Could not load this session.",
  );

  const session = data?.session ?? null;

  const handleCancel = async (reason: string) => {
    await cancelSession(sessionId, { reason });
    toast.success("Session cancelled. Both parties were notified.");
    reload();
  };

  const handleReopen = async (reason: string) => {
    await reopenSession(sessionId, { reason });
    toast.success("Session reopened and returned to the board.");
    reload();
  };

  const handleRequestChanges = async (reason: string) => {
    await requestChanges(sessionId, { reason });
    toast.success("Changes requested. The tutor was notified.");
    reload();
  };

  const handleVerify = async (input: { hours: number; note?: string | null }) => {
    try {
      await verifySession(sessionId, input);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "invalid_state" || err.status === 409)) {
        toast.error("This session changed before you verified it — refreshing.");
        reload();
      }
      throw err;
    }
    toast.success("Session verified and hours awarded.");
    reload();
  };

  const handlePriority = async (priority: PriorityLevel) => {
    if (!session || session.priority === priority) return;
    setSavingPriority(true);
    try {
      await setPriority(sessionId, { priority });
      toast.success("Priority updated.");
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message || "Could not update priority." : "Could not update priority.");
    } finally {
      setSavingPriority(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading session…
      </div>
    );
  }

  // A failed INITIAL load (no data yet) renders an empty/error state; a failed
  // REFETCH (data still present) keeps the record visible — the mutation toast
  // already surfaced the failure.
  if (!session) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {notFound ? "This session could not be found." : (error ?? "Could not load this session.")}
          </CardContent>
        </Card>
      </div>
    );
  }

  const nonTerminal = !TERMINAL.has(session.status);
  const canCancel = nonTerminal;
  const canReopen = REOPENABLE.has(session.status);
  const canRequestChanges = session.status === "completed";
  const canVerify = session.status === "completed" || session.status === "needs_changes";

  return (
    <div className="space-y-6">
      <BackLink />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            {subjectLabel(session.subject)}
          </h1>
          <div className="mt-1.5 flex items-center gap-2">
            <SessionStatusBadge status={session.status} />
            <span className="text-xs text-muted-foreground">
              Created {formatDateTime(session.created_at)}
            </span>
          </div>
        </div>
      </header>

      {/* --- Interventions --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manager actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canCancel || canReopen || canRequestChanges || canVerify ? (
            <div className="flex flex-wrap gap-2">
              {canVerify ? (
                <Button onClick={() => setDialog("verify")}>
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Verify
                </Button>
              ) : null}
              {canRequestChanges ? (
                <Button variant="outline" onClick={() => setDialog("request-changes")}>
                  <PencilLine className="size-4" aria-hidden="true" />
                  Request changes
                </Button>
              ) : null}
              {canReopen ? (
                <Button variant="outline" onClick={() => setDialog("reopen")}>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Reopen
                </Button>
              ) : null}
              {canCancel ? (
                <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDialog("cancel")}>
                  <Ban className="size-4" aria-hidden="true" />
                  Cancel
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This session is {session.status === "verified" ? "verified" : "cancelled"} — no further
              actions are available.
            </p>
          )}

          {/* Priority selector — audited but sends no party-facing email (§5.8). */}
          {nonTerminal ? (
            <div className="flex max-w-xs flex-col gap-1.5">
              <Label htmlFor="priority-select" className="text-xs text-muted-foreground">
                Priority (internal triage — no email sent)
              </Label>
              <Select
                value={session.priority}
                onValueChange={(v) => handlePriority(v as PriorityLevel)}
                disabled={savingPriority}
              >
                <SelectTrigger id="priority-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* --- Record --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field label="Requester" value={person(session.requester)} />
            <Field label="Tutor" value={session.tutor ? person(session.tutor) : "Unclaimed"} />
            <Field label="Location" value={session.location_preference === "online" ? "Online" : "In person"} />
            <Field label="Language" value={session.language ?? "—"} />
            <Field
              label="Duration"
              value={session.duration_minutes != null ? `${session.duration_minutes} min` : "—"}
            />
            <Field label="Scheduled for" value={formatDateTime(session.scheduled_at)} />
            {session.location ? <Field label="Meeting location" value={session.location} /> : null}
            {session.completed_at ? (
              <Field label="Completed" value={formatDateTime(session.completed_at)} />
            ) : null}
            {session.verified_at ? (
              <Field label="Verified" value={formatDateTime(session.verified_at)} />
            ) : null}
            {session.awarded_hours != null ? (
              <Field label="Hours awarded" value={`${formatHours(session.awarded_hours)} h`} />
            ) : null}
          </dl>

          {/* Notes */}
          <div className="mt-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Request notes</p>
            <p className="text-sm whitespace-pre-wrap text-foreground">{session.notes}</p>
          </div>

          {/* Recording */}
          {session.recording_url ? (
            <div className="mt-4">
              <a
                href={session.recording_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
              >
                <ExternalLink className="size-4" aria-hidden="true" />
                Open recording
              </a>
            </div>
          ) : null}

          {/* needs_changes / cancellation context */}
          {session.status === "needs_changes" && session.verification_note ? (
            <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
              <span className="font-medium">Changes requested:</span> {session.verification_note}
            </div>
          ) : null}
          {session.status === "cancelled" && session.cancelled_reason ? (
            <div className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              <span className="font-medium">Cancelled:</span> {session.cancelled_reason}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* --- Availability (read-only) --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Availability</CardTitle>
        </CardHeader>
        <CardContent>
          <AvailabilityView availability={session.availability} />
        </CardContent>
      </Card>

      {/* --- Timeline --- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4 text-muted-foreground" aria-hidden="true" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline entries={data?.timeline ?? []} />
        </CardContent>
      </Card>

      {/* --- Dialogs --- */}
      <ReasonDialog
        open={dialog === "cancel"}
        onOpenChange={(o) => setDialog(o ? "cancel" : null)}
        title="Cancel this session"
        description="Both the requester and the tutor will be emailed. This cannot be undone."
        label="Reason"
        placeholder="Why is this session being cancelled?"
        confirmLabel="Cancel session"
        destructive
        onSubmit={handleCancel}
      />
      <ReasonDialog
        open={dialog === "reopen"}
        onOpenChange={(o) => setDialog(o ? "reopen" : null)}
        title="Reopen this session"
        description="The claim is released and the request returns to the board. Both parties are notified."
        label="Reason"
        placeholder="Why is this session being reopened?"
        confirmLabel="Reopen session"
        onSubmit={handleReopen}
      />
      <ReasonDialog
        open={dialog === "request-changes"}
        onOpenChange={(o) => setDialog(o ? "request-changes" : null)}
        title="Request changes"
        description="The tutor is asked to fix the session and resubmit. They'll be emailed your note."
        label="What needs to change?"
        placeholder="Describe what the tutor should correct"
        confirmLabel="Request changes"
        onSubmit={handleRequestChanges}
      />
      <VerifyDialog
        session={dialog === "verify" ? session : null}
        open={dialog === "verify"}
        onOpenChange={(o) => setDialog(o ? "verify" : null)}
        onVerify={handleVerify}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/manager/sessions"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      All sessions
    </Link>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function person(p: { first_name: string; last_name: string; email?: string } | null): string {
  if (!p) return "—";
  return `${p.first_name} ${p.last_name}`.trim();
}

function Timeline({ entries }: { entries: SessionTimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No history yet.</p>;
  }
  return (
    <ol className="space-y-3">
      {entries.map((e) => (
        <li key={e.id} className="flex gap-3">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{humanizeAction(e.action)}</p>
            <p className="text-xs text-muted-foreground">
              {e.actor_name ? `${e.actor_name} · ` : ""}
              {formatDateTime(e.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Turn a dotted audit action ("session.claimed") into a readable phrase. */
function humanizeAction(action: string): string {
  const tail = action.includes(".") ? action.slice(action.indexOf(".") + 1) : action;
  const words = tail.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
