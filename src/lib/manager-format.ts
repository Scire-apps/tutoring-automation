/**
 * Manager-panel display formatters (client-safe). Turns raw enum/audit values
 * into the human-readable strings the panel renders (§5.4 "audit human-readable",
 * subject triple labels, status words). Pure functions; no I/O.
 */
import type { AuditEntry } from "@/services/api/manage";

/** Compose the human subject label from the triple ("Math · IB · Grade 11"). */
export function subjectLabel(s: {
  name: string;
  category: string | null;
  grade_level: number | null;
}): string {
  const bits: string[] = [s.name];
  if (s.category) bits.push(s.category);
  if (s.grade_level != null) bits.push(`Grade ${s.grade_level}`);
  return bits.join(" · ");
}

/** A person's display name from first/last ("Ada Lovelace"), or a fallback. */
export function personName(
  p: { first_name: string; last_name: string } | null | undefined,
  fallback = "Someone",
): string {
  if (!p) return fallback;
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || fallback;
}

/** Human label for an account status. */
export function statusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Active";
    case "pending":
      return "Pending";
    case "suspended":
      return "Suspended";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

/** Neutral (non-role-aware) human label for a session status — manager/admin view. */
export function sessionStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Open";
    case "claimed":
      return "Claimed";
    case "availability_set":
      return "Availability set";
    case "scheduled":
      return "Scheduled";
    case "completed":
      return "Awaiting verification";
    case "needs_changes":
      return "Changes requested";
    case "verified":
      return "Verified";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

/** Tailwind tone classes for a neutral session-status chip. */
export function sessionStatusTone(status: string): string {
  switch (status) {
    case "open":
      return "bg-blue-50 text-blue-700 ring-blue-600/20";
    case "claimed":
    case "availability_set":
      return "bg-amber-50 text-amber-700 ring-amber-600/20";
    case "scheduled":
    case "verified":
      return "bg-green-50 text-green-700 ring-green-600/20";
    case "completed":
      return "bg-orange-50 text-orange-700 ring-orange-600/20";
    case "needs_changes":
      return "bg-red-50 text-red-700 ring-red-600/20";
    default:
      return "bg-muted text-muted-foreground ring-border";
  }
}

/** Human label for a subject-approval status. */
export function approvalStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "withdrawn":
      return "Withdrawn";
    case "revoked":
      return "Revoked";
    default:
      return status;
  }
}

/**
 * A readable past-tense sentence for an audit entry (§5.4). The audit `action` is
 * a dotted verb (e.g. `member.admitted`, `session.verified`, `hours.adjusted`);
 * this maps the common manager/admin actions to plain English, weaving in the
 * actor name and any salient metadata. Unknown actions fall back to a humanized
 * form of the dotted action so nothing renders as a raw token.
 */
export function auditLine(entry: AuditEntry): string {
  const actor = entry.actor_name?.trim() || "Someone";
  const meta = (entry.metadata ?? {}) as Record<string, unknown>;
  const subject = typeof meta.subject_label === "string" ? meta.subject_label : null;
  const member = typeof meta.member_name === "string" ? meta.member_name : null;
  const hours = typeof meta.hours === "number" ? meta.hours : null;

  switch (entry.action) {
    case "member.admitted":
      return `${actor} admitted ${member ?? "a member"}.`;
    case "member.rejected":
      return `${actor} rejected ${member ?? "a member"}.`;
    case "member.suspended":
      return `${actor} suspended ${member ?? "a member"}.`;
    case "member.restored":
      return `${actor} restored ${member ?? "a member"}.`;
    case "subject_approval.approved":
      return `${actor} approved ${member ?? "a member"} to tutor ${subject ?? "a subject"}.`;
    case "subject_approval.rejected":
      return `${actor} rejected ${member ?? "a member"}'s request for ${subject ?? "a subject"}.`;
    case "subject_approval.revoked":
      return `${actor} revoked ${member ?? "a member"}'s approval for ${subject ?? "a subject"}.`;
    case "subject_approval.granted":
      return `${actor} granted ${member ?? "a member"} approval for ${subject ?? "a subject"}.`;
    case "session.claimed":
      return `A tutor claimed a request${subject ? ` for ${subject}` : ""}.`;
    case "session.verified":
      return `${actor} verified a session${
        hours != null ? ` and awarded ${formatHours(hours)} hours` : ""
      }.`;
    case "session.needs_changes":
      return `${actor} requested changes on a session.`;
    case "session.cancelled":
      return `${actor} cancelled a session.`;
    case "session.reopened":
      return `${actor} reopened a session.`;
    case "session.priority_changed":
      return `${actor} changed a session's priority.`;
    case "hours.adjusted":
      return `${actor} adjusted ${member ?? "a member"}'s hours${
        hours != null ? ` by ${formatHours(hours)}` : ""
      }.`;
    case "manager.approved":
      return `${actor} activated a manager.`;
    case "manager.rejected":
      return `${actor} rejected a pending manager.`;
    case "email.broadcast":
      return `${actor} sent a broadcast email.`;
    case "help.resolved":
      return `${actor} resolved a help request.`;
    default:
      return `${actor}: ${humanizeAction(entry.action)}.`;
  }
}

/** Turn a dotted action (`subject_approval.approved`) into a phrase. */
function humanizeAction(action: string): string {
  return action.replace(/[._]/g, " ");
}

/** "+1.5" / "-0.25" / "2" — signed hours, trimmed. */
export function formatHours(hours: number): string {
  const abs = Number.isInteger(hours) ? String(Math.abs(hours)) : Math.abs(hours).toFixed(2);
  return hours < 0 ? `-${abs}` : abs;
}

/** "1.5 h" / "2 h" — unsigned hours total. */
export function formatHoursTotal(hours: number): string {
  return `${Number.isInteger(hours) ? String(hours) : hours.toFixed(2)} h`;
}
