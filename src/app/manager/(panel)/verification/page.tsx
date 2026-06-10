"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  CheckCircle2,
  ExternalLink,
  Loader2,
  PencilLine,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError } from "@/services/api";
import {
  listVerificationQueue,
  requestChanges,
  verifySession,
  memberName,
  subjectLabel,
  type ManageSession,
} from "@/services/api/manage";
import { formatAge } from "@/components/manager/ui";
import { VerifyDialog } from "@/components/manager/verify-dialog";
import { ReasonDialog } from "@/components/manager/reason-dialog";
import { useList } from "@/components/manager/use-list";

const PAGE_SIZE = 100; // the queue is small; pull it in one page, oldest-first

export default function ManagerVerificationPage() {
  const [verifyTarget, setVerifyTarget] = useState<ManageSession | null>(null);
  const [changesTarget, setChangesTarget] = useState<ManageSession | null>(null);
  // Bumped after a verify / request-changes (or a 409 race) to refetch the queue.
  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((t) => t + 1);

  const { data, loading, error } = useList(
    () => listVerificationQueue({ limit: PAGE_SIZE }),
    [reloadToken],
    "Could not load the queue.",
  );
  const items = data?.items ?? [];

  const completed = items.filter((s) => s.status === "completed");
  const needsChanges = items.filter((s) => s.status === "needs_changes");

  const handleVerify = async (input: { hours: number; note?: string | null }) => {
    if (!verifyTarget) return;
    try {
      await verifySession(verifyTarget.id, input);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "invalid_state" || err.status === 409)) {
        toast.error("That session already changed — refreshing the queue.");
        reload();
      }
      throw err; // keep the dialog open for non-race errors
    }
    toast.success("Verified and hours awarded.");
    reload();
  };

  const handleRequestChanges = async (reason: string) => {
    if (!changesTarget) return;
    try {
      await requestChanges(changesTarget.id, { reason });
    } catch (err) {
      if (err instanceof ApiError && (err.code === "invalid_state" || err.status === 409)) {
        toast.error("That session already changed — refreshing the queue.");
        reload();
      }
      throw err;
    }
    toast.success("Changes requested. The tutor was notified.");
    reload();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BadgeCheck className="size-6 text-blue-600" aria-hidden="true" />
          Verification
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review completed sessions, award volunteer hours, or request changes. Oldest first.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading the queue…
        </div>
      ) : error ? (
        <p className="py-12 text-sm text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nothing to verify right now. Completed sessions will appear here.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          <QueueGroup
            title="Awaiting verification"
            subtitle="Tutors marked these complete."
            sessions={completed}
            onVerify={setVerifyTarget}
            onRequestChanges={setChangesTarget}
          />
          <QueueGroup
            title="Changes requested"
            subtitle="You asked for changes; tutors resubmitted or are still working. You can verify directly."
            sessions={needsChanges}
            onVerify={setVerifyTarget}
            onRequestChanges={setChangesTarget}
          />
        </div>
      )}

      <VerifyDialog
        session={verifyTarget}
        open={verifyTarget !== null}
        onOpenChange={(o) => {
          if (!o) setVerifyTarget(null);
        }}
        onVerify={handleVerify}
      />
      <ReasonDialog
        open={changesTarget !== null}
        onOpenChange={(o) => {
          if (!o) setChangesTarget(null);
        }}
        title="Request changes"
        description="The tutor is asked to fix the session and resubmit. They'll be emailed your note."
        label="What needs to change?"
        placeholder="Describe what the tutor should correct"
        confirmLabel="Request changes"
        onSubmit={handleRequestChanges}
      />
    </div>
  );
}

function QueueGroup({
  title,
  subtitle,
  sessions,
  onVerify,
  onRequestChanges,
}: {
  title: string;
  subtitle: string;
  sessions: ManageSession[];
  onVerify: (s: ManageSession) => void;
  onRequestChanges: (s: ManageSession) => void;
}) {
  if (sessions.length === 0) return null;
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-semibold">
          {title}
          <span className="ml-2 text-sm font-normal text-muted-foreground">({sessions.length})</span>
        </h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <ul className="space-y-3">
        {sessions.map((s) => (
          <li key={s.id}>
            <Card>
              <CardContent className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <Link
                    href={`/manager/sessions/${s.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {subjectLabel(s.subject)}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {memberName(s.tutor)} tutored {memberName(s.requester)}
                    {s.duration_minutes != null ? ` · ${s.duration_minutes} min` : ""}
                    {s.completed_at ? ` · completed ${formatAge(s.completed_at)}` : ""}
                  </p>
                  {s.status === "needs_changes" && s.verification_note ? (
                    <p className="text-sm text-amber-700">
                      <span className="font-medium">Requested:</span> {s.verification_note}
                    </p>
                  ) : null}
                  {s.recording_url ? (
                    <a
                      href={s.recording_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                    >
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      Recording
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">No recording link</span>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => onVerify(s)}>
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Verify
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onRequestChanges(s)}>
                    <PencilLine className="size-4" aria-hidden="true" />
                    Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
