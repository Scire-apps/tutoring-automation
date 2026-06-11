import type { SessionStatus } from "@/types/api";
import { cn } from "@/lib/utils";

/** Whether the viewer is the request's owner (learner) or its claimer (tutor). */
export type SessionRole = "requester" | "claimer";

type ChipTone = "blue" | "amber" | "orange" | "green" | "red" | "neutral";

const TONE_CLASS: Record<ChipTone, string> = {
  blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  orange: "bg-orange-50 text-orange-700 ring-orange-600/20",
  green: "bg-brand-subtle text-brand-strong ring-brand/25",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  neutral: "bg-muted text-muted-foreground ring-border",
};

/**
 * Human label + tone for a session status, read from the §4.3 matrix. The same
 * status reads differently to each side (e.g. `claimed` is the learner's cue to
 * set availability but the tutor's "waiting" state), so the label is role-aware.
 */
function describe(
  status: SessionStatus,
  role: SessionRole,
): { label: string; tone: ChipTone } {
  switch (status) {
    case "open":
      return { label: "Open", tone: "blue" };
    case "claimed":
      return role === "requester"
        ? { label: "Set availability", tone: "red" }
        : { label: "Waiting on learner", tone: "amber" };
    case "availability_set":
      return role === "requester"
        ? { label: "Awaiting schedule", tone: "orange" }
        : { label: "Schedule it", tone: "red" };
    case "scheduled":
      return { label: "Scheduled", tone: "green" };
    case "completed":
      return { label: "Awaiting verification", tone: "amber" };
    case "needs_changes":
      return role === "claimer"
        ? { label: "Changes requested", tone: "amber" }
        : { label: "Awaiting verification", tone: "amber" };
    case "verified":
      return { label: "Verified", tone: "green" };
    case "cancelled":
      return { label: "Cancelled", tone: "neutral" };
    default:
      return { label: status, tone: "neutral" };
  }
}

/**
 * Role-aware session status pill (§4.3). Pass the viewer's `role` so the label
 * matches what THEY need to do; defaults to the requester reading.
 */
export function StatusChip({
  status,
  role = "requester",
  className,
}: {
  status: SessionStatus;
  role?: SessionRole;
  className?: string;
}) {
  const { label, tone } = describe(status, role);
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE_CLASS[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
