"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import type { SessionStatus } from "@/types/api";
import {
  listSessions,
  verifySession,
  cancelSession,
  subjectLabel,
  personName,
  type AdminSession,
  type AdminSessionFilters,
} from "@/services/api/admin";
import { ApiError } from "@/services/api";
import { SessionStatusBadge, formatDateTime, formatAge } from "@/components/manager/ui";
import { AdminVerifyDialog, AdminCancelSessionDialog } from "@/components/admin/session-dialogs";
import { Pagination } from "@/components/manager/pagination";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 25;

const ALL_STATUSES: SessionStatus[] = [
  "open",
  "claimed",
  "availability_set",
  "scheduled",
  "completed",
  "needs_changes",
  "verified",
  "cancelled",
];

const STATUS_LABEL: Record<SessionStatus, string> = {
  open: "Open",
  claimed: "Claimed",
  availability_set: "Availability set",
  scheduled: "Scheduled",
  completed: "Awaiting verification",
  needs_changes: "Changes requested",
  verified: "Verified",
  cancelled: "Cancelled",
};

/**
 * Reusable global/per-org session oversight list (§6.3). The caller fixes
 * `org_id` via `baseFilters` (omitted = global). Status multi-filter + debounced
 * search; each row expands to a detail with a Verify dialog (`awarded_hours`) when
 * completed|needs_changes and a Cancel dialog (reason) when non-terminal. Mutations
 * refetch + toast; a 409 on verify refetches (the session changed first).
 */
export function SessionList({
  baseFilters = {},
  showOrg = false,
}: {
  baseFilters?: AdminSessionFilters;
  showOrg?: boolean;
}) {
  const [statuses, setStatuses] = useState<SessionStatus[]>([]);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);

  const [data, setData] = useState<{ items: AdminSession[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<AdminSession | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminSession | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(qInput.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(id);
  }, [qInput]);

  const baseKey = JSON.stringify(baseFilters);
  const statusKey = statuses.join(",");

  // Stale-while-revalidate: refetches keep prior rows visible, so the spinner
  // (`loading && !data`) only shows on first paint — no sync setLoading(true).
  useEffect(() => {
    let ignore = false;
    listSessions({
      ...baseFilters,
      status: statuses.length ? statuses : undefined,
      q: q || undefined,
      limit: PAGE_SIZE,
      offset,
    })
      .then((res) => {
        if (ignore) return;
        setData({ items: res.items, total: res.total });
        setError(null);
      })
      .catch((e: unknown) => {
        if (ignore) return;
        setError(e instanceof Error ? e.message || "Couldn't load sessions." : "Couldn't load sessions.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey, statusKey, q, offset, reloadToken]);

  const reload = () => setReloadToken((t) => t + 1);
  const sessions = data?.items ?? [];
  const total = data?.total ?? 0;

  function toggleStatus(s: SessionStatus) {
    setOffset(0);
    setStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function handleVerify(input: { awarded_hours: number; note?: string | null }) {
    if (!verifyTarget) return;
    try {
      await verifySession(verifyTarget.id, input);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "invalid_state" || err.status === 409)) {
        toast.error("This session changed before you verified it — refreshing.");
        reload();
      }
      throw err;
    }
    toast.success("Session verified and hours awarded.");
    reload();
  }

  async function handleCancel(reason: string) {
    if (!cancelTarget) return;
    await cancelSession(cancelTarget.id, { reason });
    toast.success("Session cancelled. Both parties were notified.");
    reload();
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {ALL_STATUSES.map((s) => {
            const on = statuses.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => toggleStatus(s)}
                className={
                  on
                    ? "rounded-full bg-brand px-3 py-1 text-xs font-medium text-white"
                    : "rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
                }
              >
                {STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-8"
            placeholder="Search notes or names"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading sessions…
        </div>
      ) : error && !data ? (
        <p className="py-12 text-sm text-destructive">{error}</p>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No sessions match these filters.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y">
            {sessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                showOrg={showOrg}
                expanded={expandedId === s.id}
                onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
                onVerify={() => setVerifyTarget(s)}
                onCancel={() => setCancelTarget(s)}
              />
            ))}
          </ul>
        </Card>
      )}

      <Pagination total={total} limit={PAGE_SIZE} offset={offset} onOffsetChange={setOffset} />

      <AdminVerifyDialog
        session={verifyTarget}
        open={verifyTarget !== null}
        onOpenChange={(o) => {
          if (!o) setVerifyTarget(null);
        }}
        onVerify={handleVerify}
      />
      <AdminCancelSessionDialog
        open={cancelTarget !== null}
        onOpenChange={(o) => {
          if (!o) setCancelTarget(null);
        }}
        onConfirm={handleCancel}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- Row --- */

const TERMINAL = new Set<SessionStatus>(["verified", "cancelled"]);

function SessionRow({
  session,
  showOrg,
  expanded,
  onToggle,
  onVerify,
  onCancel,
}: {
  session: AdminSession;
  showOrg: boolean;
  expanded: boolean;
  onToggle: () => void;
  onVerify: () => void;
  onCancel: () => void;
}) {
  const canVerify = session.status === "completed" || session.status === "needs_changes";
  const canCancel = !TERMINAL.has(session.status);

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium text-foreground">{subjectLabel(session.subject)}</span>
            <SessionStatusBadge status={session.status} />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {showOrg && session.org ? <>{session.org.name} · </> : null}
            {personName(session.requester)}
            {session.tutor ? <> {"→"} {personName(session.tutor)}</> : <> · unclaimed</>}
            {" · "}
            {formatAge(session.created_at)}
          </p>
        </div>
      </button>

      {expanded ? (
        <div className="space-y-4 border-t bg-muted/20 px-4 py-4">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field label="Requester" value={personName(session.requester)} />
            <Field label="Tutor" value={session.tutor ? personName(session.tutor) : "Unclaimed"} />
            <Field
              label="Location"
              value={session.location_preference === "online" ? "Online" : "In person"}
            />
            <Field label="Language" value={session.language ?? "—"} />
            <Field
              label="Duration"
              value={session.duration_minutes != null ? `${session.duration_minutes} min` : "—"}
            />
            <Field label="Scheduled for" value={formatDateTime(session.scheduled_at)} />
            {session.awarded_hours != null ? (
              <Field label="Hours awarded" value={`${session.awarded_hours} h`} />
            ) : null}
          </dl>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Request notes</p>
            <p className="text-sm whitespace-pre-wrap text-foreground">{session.notes}</p>
          </div>

          {session.recording_url ? (
            <a
              href={session.recording_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              Open recording
            </a>
          ) : null}

          {session.status === "cancelled" && session.cancelled_reason ? (
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              <span className="font-medium">Cancelled:</span> {session.cancelled_reason}
            </div>
          ) : null}

          {canVerify || canCancel ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {canVerify ? <Button size="sm" onClick={onVerify}>Verify</Button> : null}
              {canCancel ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={onCancel}
                >
                  Cancel session
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              This session is {session.status} — no further actions are available.
            </p>
          )}
        </div>
      ) : null}
    </li>
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
