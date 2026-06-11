"use client";

import { useState } from "react";
import {
  ChevronDown,
  GraduationCap,
  BookOpen,
  Calendar,
  MapPin,
  Globe,
  Clock,
  Video,
} from "lucide-react";

import type { MemberSession } from "@/services/api/member";
import { cn } from "@/lib/utils";
import { StatusChip, type SessionRole } from "@/components/status-chip";

/** Pretty-print an ISO timestamp as a readable local date + time. */
function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function RoleChip({ role }: { role: SessionRole }) {
  const tutoring = role === "claimer";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tutoring
          ? "bg-brand-subtle text-brand-strong ring-brand/20"
          : "bg-slate-100 text-slate-600 ring-slate-500/20",
      )}
    >
      {tutoring ? (
        <GraduationCap className="size-3" aria-hidden="true" />
      ) : (
        <BookOpen className="size-3" aria-hidden="true" />
      )}
      {tutoring ? "Tutoring" : "Learning"}
    </span>
  );
}

/**
 * One row in the member "My Sessions" list (§4.3). Presentational: it renders the
 * role chip ("Tutoring"/"Learning"), counterpart, subject and role-aware status
 * chip, and expands to show the session details. The role-aware ACTIONS (set
 * availability, schedule, complete, cancel, …) are passed in by the dashboard,
 * which owns the API calls and the transition matrix.
 *
 * The expandable details are always available; `defaultOpen` controls the initial
 * state (the dashboard opens rows that need the member's attention).
 */
export function SessionRow({
  session,
  actions,
  defaultOpen = false,
}: {
  session: MemberSession;
  actions?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const role = session.role;
  const counterpart =
    role === "claimer" ? session.requester_name : session.tutor_name;

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <RoleChip role={role} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-medium tracking-tight text-foreground">
            {session.subject_label}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {counterpart ? (
              <>
                {role === "claimer" ? "Helping" : "Tutored by"}{" "}
                <span className="text-foreground">{counterpart}</span>
              </>
            ) : (
              "Awaiting a tutor"
            )}
          </p>
        </div>
        <StatusChip status={session.status} role={role} />
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="space-y-3 border-t px-4 py-3 text-sm">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <Detail
              icon={session.location_preference === "online" ? Globe : MapPin}
              label="Location"
              value={
                session.location_preference === "online"
                  ? session.location
                    ? `Online — ${session.location}`
                    : "Online"
                  : session.location
                    ? `In person — ${session.location}`
                    : "In person"
              }
            />
            {session.duration_minutes ? (
              <Detail
                icon={Clock}
                label="Duration"
                value={`${session.duration_minutes} minutes`}
              />
            ) : null}
            {session.scheduled_at ? (
              <Detail
                icon={Calendar}
                label="Scheduled"
                value={formatDateTime(session.scheduled_at)}
              />
            ) : null}
            {session.language ? (
              <Detail icon={Globe} label="Language" value={session.language} />
            ) : null}
          </dl>

          {session.notes ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Notes</p>
              <p className="mt-0.5 whitespace-pre-wrap text-foreground">
                {session.notes}
              </p>
            </div>
          ) : null}

          {session.recording_url ? (
            <a
              href={session.recording_url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-brand hover:underline"
            >
              <Video className="size-4" aria-hidden="true" />
              Recording link
            </a>
          ) : null}

          {session.status === "needs_changes" && session.verification_note ? (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-amber-800 ring-1 ring-inset ring-amber-600/20">
              <p className="text-xs font-medium">Changes requested</p>
              <p className="mt-0.5 whitespace-pre-wrap">
                {session.verification_note}
              </p>
            </div>
          ) : null}

          {session.status === "verified" && session.awarded_hours != null ? (
            <p className="text-green-700">
              Verified — {session.awarded_hours} volunteer{" "}
              {session.awarded_hours === 1 ? "hour" : "hours"} awarded.
            </p>
          ) : null}

          {actions ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div>
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="text-foreground tabular-nums">{value}</dd>
      </div>
    </div>
  );
}
