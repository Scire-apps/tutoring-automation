"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  GraduationCap,
  BookOpen,
  BadgeCheck,
  HandHelping,
  ClipboardList,
  LifeBuoy,
  PartyPopper,
  Inbox,
  X,
} from "lucide-react";

import type { MemberSession, MemberDashboard } from "@/services/api/member";
import {
  getDashboard,
  cancelSession,
  completeSession,
} from "@/services/api/member";
import { ApiError } from "@/services/api";
import { useAuth } from "@/app/providers";
import { useMemberContext } from "@/components/member-layout";
import { GateCard } from "@/components/gate-card";
import { ActionCard } from "@/components/action-card";
import { SessionRow } from "@/components/session-row";
import { StatusChip } from "@/components/status-chip";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { HelpModal } from "@/components/help-modal";
import { RecordingLinkModal } from "@/components/recording-link-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BRAND } from "@/lib/brand";

const NUDGE_DISMISS_KEY = "scire.member.profileNudgeDismissed";

/** Read a boolean flag from localStorage, tolerating unavailability (SSR/denied). */
function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/** Set a boolean flag in localStorage, tolerating unavailability. */
function writeFlag(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

export default function MemberDashboardPage() {
  const { profile, refreshProfile } = useMemberContext();

  // Non-active members get the gate card (§4.4); active members get the
  // full dashboard (§4.3). Narrowing on `profile.status` (not the derived
  // `isActive`) lets TS exclude "active" from the gate-card status union.
  if (profile.status !== "active") {
    return (
      <MemberGate
        status={profile.status}
        orgName={profile.org?.name ?? null}
        statusNote={profile.status_note ?? null}
        onRefresh={refreshProfile}
      />
    );
  }

  return <ActiveDashboard />;
}

/* ------------------------------------------------------------------ Gate --- */

function MemberGate({
  status,
  orgName,
  statusNote,
  onRefresh,
}: {
  status: "pending" | "suspended" | "rejected";
  orgName: string | null;
  statusNote: string | null;
  onRefresh: () => Promise<void>;
}) {
  const { signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="grid min-h-[70vh] place-items-center">
      <GateCard
        status={status}
        orgName={orgName}
        statusNote={statusNote}
        actions={
          <>
            <Button onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? "Checking…" : "Refresh status"}
            </Button>
            <Button variant="outline" onClick={() => void signOut()}>
              Sign out
            </Button>
          </>
        }
      />
    </div>
  );
}

/* -------------------------------------------------------- Active dashboard --- */

function ActiveDashboard() {
  const { profile, refreshCounts } = useMemberContext();
  const [data, setData] = useState<MemberDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const admittedKey = `scire.member.admittedSeen.${profile.id}`;

  // One-time "you've been admitted" banner (once per browser per admission).
  // Lazy-init reads localStorage on the client; the WRITE happens in an effect
  // (writing to an external system, not a synchronous in-effect setState).
  const [admittedBanner] = useState<boolean>(() => !readFlag(admittedKey));
  // Whether the member dismissed the profile nudge — this session or a prior one
  // (lazy-read from localStorage). Derived `showNudge` gates actual display.
  const [nudgeDismissed, setNudgeDismissed] = useState<boolean>(() =>
    readFlag(NUDGE_DISMISS_KEY),
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await getDashboard();
      setData(d);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message || "Couldn't load your dashboard."
          : "Couldn't load your dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount: setData/setError run only after the awaited request.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async (post-await) data fetch
    void load();
  }, [load]);

  // Persist that the admission banner has been shown (external write only).
  useEffect(() => {
    if (admittedBanner) writeFlag(admittedKey);
  }, [admittedBanner, admittedKey]);

  function dismissNudge() {
    setNudgeDismissed(true);
    writeFlag(NUDGE_DISMISS_KEY);
  }

  // Refresh both the dashboard payload and the nav badge after a mutation.
  const afterMutation = useCallback(async () => {
    await Promise.all([load(), refreshCounts()]);
  }, [load, refreshCounts]);

  const showNudge =
    !nudgeDismissed && profile.grade == null && profile.pronouns == null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back, {profile.first_name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {profile.org ? profile.org.name : BRAND.name}
        </p>
      </header>

      {admittedBanner ? (
        <Alert className="border-green-200 bg-green-50 text-green-900">
          <PartyPopper className="size-4 text-green-600" />
          <AlertTitle>
            You&apos;ve been admitted{profile.org ? ` to ${profile.org.name}` : ""}!
          </AlertTitle>
          <AlertDescription className="text-green-800">
            You can now request and give tutoring.
          </AlertDescription>
        </Alert>
      ) : null}

      {showNudge ? (
        <Alert className="relative border-blue-200 bg-blue-50 text-blue-900">
          <BadgeCheck className="size-4 text-blue-600" />
          <AlertTitle>Complete your profile</AlertTitle>
          <AlertDescription className="text-blue-800">
            <span>
              Add your grade and pronouns so tutors know who they&apos;re helping.{" "}
              <Link
                href="/member/profile"
                className="font-medium underline underline-offset-4"
              >
                Complete profile
              </Link>
            </span>
          </AlertDescription>
          <button
            type="button"
            onClick={dismissNudge}
            aria-label="Dismiss"
            className="absolute top-2 right-2 rounded-md p-1 text-blue-700 hover:bg-blue-100"
          >
            <X className="size-4" />
          </button>
        </Alert>
      ) : null}

      {/* Stats */}
      <StatGrid data={data} loading={loading} />

      {/* Quick actions */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Quick actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ActionCard
            icon={HandHelping}
            title="Request tutoring"
            description="Post a request and get matched with a tutor."
            href="/member/request"
          />
          <ActionCard
            icon={ClipboardList}
            title="Browse the board"
            description="Claim a request you're approved to tutor."
            href="/member/board"
          />
          <ActionCard
            icon={BadgeCheck}
            title="Request subject approval"
            description="Get approved to tutor a new subject."
            href="/member/approvals"
          />
          <ActionCard
            icon={LifeBuoy}
            title="Ask for help"
            description="Send a question to a manager."
            onClick={() => setHelpOpen(true)}
          />
        </div>
      </section>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* My Requests (open sessions I posted) */}
      <MyRequests
        sessions={data?.open_requests ?? []}
        loading={loading}
        onChanged={afterMutation}
      />

      {/* My Sessions (both directions, active lifecycle) */}
      <MySessions
        sessions={data?.sessions ?? []}
        loading={loading}
        onChanged={afterMutation}
      />

      {/* Past Sessions (last 10 verified + terminal cancelled) */}
      <PastSessions sessions={data?.past_sessions ?? []} loading={loading} />

      <HelpModal open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

/* --------------------------------------------------------------- Stat grid --- */

function StatGrid({
  data,
  loading,
}: {
  data: MemberDashboard | null;
  loading: boolean;
}) {
  const stats = [
    {
      label: "Volunteer hours",
      value: data ? formatHours(data.stats.volunteer_hours) : "—",
      icon: Clock,
    },
    {
      label: "Sessions tutored",
      value: data ? String(data.stats.sessions_tutored) : "—",
      icon: GraduationCap,
    },
    {
      label: "Sessions received",
      value: data ? String(data.stats.sessions_received) : "—",
      icon: BookOpen,
    },
    {
      label: "Approved subjects",
      value: data ? String(data.stats.approved_subjects) : "—",
      icon: BadgeCheck,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <Card key={s.label} className="gap-2 py-5">
            <CardContent className="space-y-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <p
                className={
                  loading
                    ? "text-2xl font-semibold text-muted-foreground"
                    : "text-2xl font-semibold text-foreground"
                }
              >
                {s.value}
              </p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2);
}

/* -------------------------------------------------------------- My Requests --- */

function MyRequests({
  sessions,
  loading,
  onChanged,
}: {
  sessions: MemberSession[];
  loading: boolean;
  onChanged: () => Promise<void>;
}) {
  const [cancelId, setCancelId] = useState<string | null>(null);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">My requests</h2>
      {loading && sessions.length === 0 ? (
        <SkeletonRows />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          message="You have no open requests."
          cta={{ href: "/member/request", label: "Request tutoring" }}
        />
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {s.subject_label}
                </p>
                <p className="text-sm text-muted-foreground">
                  Waiting for a tutor to claim it
                </p>
              </div>
              <StatusChip status={s.status} role="requester" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelId(s.id)}
              >
                Cancel
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={cancelId !== null}
        onOpenChange={(open) => {
          if (!open) setCancelId(null);
        }}
        title="Cancel this request?"
        description="This removes your open request. You can always post a new one."
        confirmLabel="Cancel request"
        cancelLabel="Keep it"
        destructive
        onConfirm={async () => {
          if (!cancelId) return;
          await cancelSession(cancelId);
          setCancelId(null);
          await onChanged();
        }}
      />
    </section>
  );
}

/* -------------------------------------------------------------- My Sessions --- */

function MySessions({
  sessions,
  loading,
  onChanged,
}: {
  sessions: MemberSession[];
  loading: boolean;
  onChanged: () => Promise<void>;
}) {
  const [cancelTarget, setCancelTarget] = useState<MemberSession | null>(null);
  const [recordingTarget, setRecordingTarget] = useState<MemberSession | null>(
    null,
  );

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">My sessions</h2>
      {loading && sessions.length === 0 ? (
        <SkeletonRows />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          message="No active sessions. Claim a request or post one to get started."
        />
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              defaultOpen={needsAttention(s)}
              actions={
                <SessionActions
                  session={s}
                  onCancel={() => setCancelTarget(s)}
                  onRecording={() => setRecordingTarget(s)}
                  onChanged={onChanged}
                />
              }
            />
          ))}
        </div>
      )}

      {/* Cancel / release (role-aware copy) */}
      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        title={
          cancelTarget?.role === "claimer"
            ? "Release this session?"
            : "Cancel this session?"
        }
        description={
          cancelTarget?.role === "claimer"
            ? "It goes back on the board for another tutor to claim. The learner keeps their request."
            : "This cancels the session for both of you."
        }
        confirmLabel={
          cancelTarget?.role === "claimer" ? "Release" : "Cancel session"
        }
        cancelLabel="Never mind"
        destructive
        onConfirm={async () => {
          if (!cancelTarget) return;
          await cancelSession(cancelTarget.id);
          setCancelTarget(null);
          await onChanged();
        }}
      />

      {/* Recording link modal (claimer; sibling-owned component) */}
      {recordingTarget ? (
        <RecordingLinkModal
          open={recordingTarget !== null}
          onOpenChange={(open: boolean) => {
            if (!open) setRecordingTarget(null);
          }}
          sessionId={recordingTarget.id}
          currentUrl={recordingTarget.recording_url}
          onSaved={onChanged}
        />
      ) : null}
    </section>
  );
}

function needsAttention(s: MemberSession): boolean {
  if (s.role === "requester") return s.status === "claimed";
  // claimer
  return s.status === "availability_set" || s.status === "needs_changes";
}

/**
 * The §4.3 role-aware action matrix for a single active session. Navigation
 * actions link to the scheduling pages (sibling-owned); cancel/release and
 * complete are wired here.
 */
function SessionActions({
  session,
  onCancel,
  onRecording,
  onChanged,
}: {
  session: MemberSession;
  onCancel: () => void;
  onRecording: () => void;
  onChanged: () => Promise<void>;
}) {
  const [completing, setCompleting] = useState(false);
  const isRequester = session.role === "requester";

  const cancelBtn = (
    <Button variant="outline" size="sm" onClick={onCancel}>
      {isRequester ? "Cancel" : "Release"}
    </Button>
  );

  async function handleComplete() {
    setCompleting(true);
    try {
      await completeSession(session.id);
      await onChanged();
    } catch {
      // The modal/toast layer surfaces failures; leave state untouched.
    } finally {
      setCompleting(false);
    }
  }

  switch (session.status) {
    case "claimed":
      return isRequester ? (
        <>
          <Button asChild size="sm" variant="destructive">
            <Link href={`/member/sessions/${session.id}/availability`}>
              Set your availability
            </Link>
          </Button>
          {cancelBtn}
        </>
      ) : (
        <>
          <span className="text-sm text-muted-foreground">
            Waiting for {session.requester_name ?? "the learner"} to set
            availability…
          </span>
          {cancelBtn}
        </>
      );

    case "availability_set":
      return isRequester ? (
        <>
          <Button asChild size="sm" variant="outline">
            <Link href={`/member/sessions/${session.id}/availability`}>
              Edit availability
            </Link>
          </Button>
          {cancelBtn}
        </>
      ) : (
        <>
          <Button asChild size="sm" variant="destructive">
            <Link href={`/member/sessions/${session.id}/schedule`}>
              Schedule
            </Link>
          </Button>
          {cancelBtn}
        </>
      );

    case "scheduled":
      return isRequester ? (
        cancelBtn
      ) : (
        <>
          <Button size="sm" variant="outline" onClick={onRecording}>
            Recording link
          </Button>
          <Button
            size="sm"
            onClick={handleComplete}
            disabled={completing || !session.recording_url}
            title={
              session.recording_url
                ? undefined
                : "Add the recording link first"
            }
          >
            {completing ? "Completing…" : "Complete session"}
          </Button>
          {cancelBtn}
        </>
      );

    case "needs_changes":
      return isRequester ? (
        <span className="text-sm text-muted-foreground">
          Awaiting verification
        </span>
      ) : (
        <>
          <Button size="sm" variant="outline" onClick={onRecording}>
            Update link
          </Button>
          <Button
            size="sm"
            onClick={handleComplete}
            disabled={completing || !session.recording_url}
          >
            {completing ? "Resubmitting…" : "Resubmit"}
          </Button>
        </>
      );

    case "completed":
      return (
        <span className="text-sm text-muted-foreground">
          {isRequester
            ? "Awaiting verification"
            : "Awaiting verification — hours pending"}
        </span>
      );

    default:
      return null;
  }
}

/* ------------------------------------------------------------ Past Sessions --- */

function PastSessions({
  sessions,
  loading,
}: {
  sessions: MemberSession[];
  loading: boolean;
}) {
  if (loading && sessions.length === 0) return null;
  if (sessions.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Past sessions</h2>
      <ul className="space-y-2">
        {sessions.map((s) => {
          const counterpart =
            s.role === "claimer" ? s.requester_name : s.tutor_name;
          return (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {s.subject_label}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {s.status === "cancelled" && s.cancelled_by === "manager"
                    ? `Cancelled by your organization${
                        s.cancel_reason ? `: ${s.cancel_reason}` : ""
                      }`
                    : counterpart
                      ? `${s.role === "claimer" ? "Tutored" : "With"} ${counterpart}`
                      : "—"}
                </p>
              </div>
              {s.status === "verified" && s.awarded_hours != null ? (
                <span className="text-sm font-medium text-green-700">
                  +{formatHours(s.awarded_hours)} h
                </span>
              ) : null}
              <StatusChip status={s.status} role={s.role} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* --------------------------------------------------------------- Primitives --- */

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-lg border bg-muted/40"
        />
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  message,
  cta,
}: {
  icon: typeof Inbox;
  message: string;
  cta?: { href: string; label: string };
}) {
  return (
    <Card className="items-center gap-3 py-8 text-center">
      <CardContent className="flex flex-col items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <p className="text-sm text-muted-foreground">{message}</p>
        {cta ? (
          <Button asChild size="sm" variant="outline">
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
