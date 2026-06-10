"use client";

/**
 * Shared presentational helpers for the manager panel part-2 screens (§5.8–§5.13):
 * priority/urgency badges, the session status pill (manager reading), a lightweight
 * segmented tab control, a read-only availability view, and a few formatters. Kept
 * in one module so the sessions / verification / hours / subjects / emails / help
 * pages render consistently without each re-deriving the same bits.
 */
import { cn } from "@/lib/utils";
import type {
  PriorityLevel,
  SessionStatus,
  UrgencyLevel,
} from "@/types/api";

// --- Formatters --------------------------------------------------------------

/** "Jun 9, 2026, 2:30 PM" — absolute, locale-aware. `—` for null. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Jun 9, 2026" — date only. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** "3 days ago" / "5h ago" / "just now" — coarse relative age for queues. */
export function formatAge(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/** Format a decimal hours value compactly (2 → "2", 2.25 → "2.25"). */
export function formatHours(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

// --- Badges ------------------------------------------------------------------

type Tone = "blue" | "amber" | "orange" | "green" | "red" | "purple" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  orange: "bg-orange-50 text-orange-700 ring-orange-600/20",
  green: "bg-green-50 text-green-700 ring-green-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  purple: "bg-purple-50 text-purple-700 ring-purple-600/20",
  neutral: "bg-muted text-muted-foreground ring-border",
};

function Pill({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const PRIORITY_META: Record<PriorityLevel, { label: string; tone: Tone }> = {
  high: { label: "High", tone: "red" },
  normal: { label: "Normal", tone: "neutral" },
  low: { label: "Low", tone: "blue" },
};

/** Triage-priority badge (§5.8). `normal` renders muted to keep the table calm. */
export function PriorityBadge({ priority, className }: { priority: PriorityLevel; className?: string }) {
  const { label, tone } = PRIORITY_META[priority];
  return (
    <Pill tone={tone} className={className}>
      {label}
    </Pill>
  );
}

const URGENCY_META: Record<UrgencyLevel, { label: string; tone: Tone }> = {
  high: { label: "High", tone: "red" },
  normal: { label: "Normal", tone: "amber" },
  low: { label: "Low", tone: "blue" },
};

/** Three-level help-urgency badge (§5.13). */
export function UrgencyBadge({ urgency, className }: { urgency: UrgencyLevel; className?: string }) {
  const { label, tone } = URGENCY_META[urgency];
  return (
    <Pill tone={tone} className={className}>
      {label}
    </Pill>
  );
}

const SESSION_STATUS_META: Record<SessionStatus, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "blue" },
  claimed: { label: "Claimed", tone: "purple" },
  availability_set: { label: "Availability set", tone: "orange" },
  scheduled: { label: "Scheduled", tone: "green" },
  completed: { label: "Awaiting verification", tone: "amber" },
  needs_changes: { label: "Changes requested", tone: "amber" },
  verified: { label: "Verified", tone: "green" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/** Manager-reading session status pill (neutral, not role-relative). */
export function SessionStatusBadge({ status, className }: { status: SessionStatus; className?: string }) {
  const { label, tone } = SESSION_STATUS_META[status];
  return (
    <Pill tone={tone} className={className}>
      {label}
    </Pill>
  );
}

/** Human label for a session status (for selects/filters). */
export function sessionStatusLabel(status: SessionStatus): string {
  return SESSION_STATUS_META[status].label;
}

// --- Segmented tabs ----------------------------------------------------------

/**
 * A minimal segmented control used for the Totals/Ledger, Compose/History and
 * Open/Resolved tab pairs (the project ships no shadcn Tabs primitive; the member
 * zone used the same lightweight pattern). Controlled via `value`/`onChange`.
 */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1", className)}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.count != null && t.count > 0 ? (
              <span
                className={cn(
                  "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                  active ? "bg-blue-600 text-white" : "bg-muted-foreground/15 text-foreground",
                )}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// --- Read-only availability view ---------------------------------------------

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Read-only render of a session's stored availability (§5.8). The interactive
 * TwoWeekTimeGrid is anchored to a rolling 14-day window from "today" and offers
 * no read-only mode, so it can't faithfully show an arbitrary (possibly past)
 * availability map; this renders the actual `{ "YYYY-MM-DD": ["HH:MM-HH:MM"] }`
 * shape directly as a compact per-day list of windows.
 */
export function AvailabilityView({ availability }: { availability: Record<string, string[]> | null }) {
  const days = availability ? Object.keys(availability).sort() : [];
  if (days.length === 0) {
    return <p className="text-sm text-muted-foreground">No availability set yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {days.map((date) => {
        const windows = availability![date] ?? [];
        const d = new Date(`${date}T00:00:00`);
        const dow = Number.isNaN(d.getTime()) ? "" : WEEKDAY[d.getDay()];
        return (
          <li key={date} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="w-40 shrink-0 text-sm font-medium text-foreground">
              {dow ? `${dow}, ` : ""}
              {formatDate(`${date}T00:00:00`)}
            </span>
            <span className="flex flex-wrap gap-1.5">
              {windows.length === 0 ? (
                <span className="text-sm text-muted-foreground">—</span>
              ) : (
                windows.map((w) => (
                  <span
                    key={w}
                    className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20"
                  >
                    {w}
                  </span>
                ))
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// --- Small helpers -----------------------------------------------------------

/** Trigger a browser download of a Blob (used by the hours CSV export, §5.10). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
