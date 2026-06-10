/**
 * Admin-panel display formatters (client-safe). The admin audit vocabulary is a
 * SUPERSET of the manager one (it adds org.* / template.* / member.delete /
 * manager.invite|delete / admin.login), so this maps those plus the shared verbs
 * to plain English. Pure functions; no I/O.
 */
import type { AdminAuditEntry } from "@/services/api/admin";

/** Human label for an account kind. */
export function accountKindLabel(kind: string): string {
  switch (kind) {
    case "member":
      return "Member";
    case "manager":
      return "Manager";
    case "admin":
      return "Admin";
    default:
      return kind;
  }
}

/**
 * A readable past-tense sentence for an admin audit entry (§6.3). Weaves in the
 * actor, the org name (audit rows are cross-org for an admin), and salient
 * metadata. Unknown actions fall back to a humanized dotted form.
 */
export function adminAuditLine(entry: AdminAuditEntry): string {
  const actor = entry.actor_name?.trim() || "Someone";
  const org = entry.org_name ? ` in ${entry.org_name}` : "";
  const meta = (entry.metadata ?? {}) as Record<string, unknown>;
  const subject = typeof meta.subject_label === "string" ? meta.subject_label : null;
  const member = typeof meta.member_name === "string" ? meta.member_name : null;
  const orgName = typeof meta.org_name === "string" ? meta.org_name : null;
  const hours = typeof meta.hours === "number" ? meta.hours : null;

  switch (entry.action) {
    case "admin.login":
      return `${actor} signed in to the admin panel.`;
    case "org.created":
      return `${actor} created the organization ${orgName ?? entry.org_name ?? ""}.`.trim();
    case "org.updated":
      return `${actor} updated ${entry.org_name ?? "an organization"}.`;
    case "org.archived":
      return `${actor} archived ${entry.org_name ?? "an organization"}.`;
    case "org.restored":
      return `${actor} restored ${entry.org_name ?? "an organization"}.`;
    case "org.subject.created":
      return `${actor} added ${subject ?? "a subject"}${org}.`;
    case "org.subject.deactivated":
      return `${actor} deactivated ${subject ?? "a subject"}${org}.`;
    case "org.subject.reactivated":
      return `${actor} reactivated ${subject ?? "a subject"}${org}.`;
    case "member.admitted":
      return `${actor} admitted ${member ?? "a member"}${org}.`;
    case "member.rejected":
      return `${actor} rejected ${member ?? "a member"}${org}.`;
    case "member.suspended":
      return `${actor} suspended ${member ?? "a member"}${org}.`;
    case "member.restored":
      return `${actor} restored ${member ?? "a member"}${org}.`;
    case "member.deleted":
      return `${actor} deleted ${member ?? "an account"}${org}.`;
    case "manager.approved":
      return `${actor} activated a manager${org}.`;
    case "manager.rejected":
      return `${actor} rejected a pending manager${org}.`;
    case "manager.suspended":
      return `${actor} suspended a manager${org}.`;
    case "manager.invited":
      return `${actor} invited a manager${org}.`;
    case "manager.deleted":
      return `${actor} deleted a manager account${org}.`;
    case "subject_approval.approved":
      return `${actor} approved ${member ?? "a member"} to tutor ${subject ?? "a subject"}${org}.`;
    case "subject_approval.rejected":
      return `${actor} rejected ${member ?? "a member"}'s request for ${subject ?? "a subject"}${org}.`;
    case "subject_approval.revoked":
      return `${actor} revoked ${member ?? "a member"}'s approval for ${subject ?? "a subject"}${org}.`;
    case "session.verified":
      return `${actor} verified a session${
        hours != null ? ` and awarded ${formatSignedHours(hours)} hours` : ""
      }${org}.`;
    case "session.cancelled":
      return `${actor} cancelled a session${org}.`;
    case "hours.adjusted":
      return `${actor} adjusted ${member ?? "a member"}'s hours${
        hours != null ? ` by ${formatSignedHours(hours)}` : ""
      }${org}.`;
    case "template.created":
      return `${actor} added a subject to the default template.`;
    case "template.updated":
      return `${actor} edited a default-template subject.`;
    case "template.deleted":
      return `${actor} removed a default-template subject.`;
    default:
      return `${actor}: ${humanizeAction(entry.action)}${org}.`;
  }
}

/** Turn a dotted action (`org.subject.created`) into a phrase. */
function humanizeAction(action: string): string {
  return action.replace(/[._]/g, " ");
}

/** "+1.5" / "-0.25" / "2" — signed hours, trimmed. */
export function formatSignedHours(hours: number): string {
  const abs = Number.isInteger(hours) ? String(Math.abs(hours)) : Math.abs(hours).toFixed(2);
  return hours < 0 ? `-${abs}` : abs;
}

/** "1.5" / "2" — unsigned hours, trimmed (no unit). */
export function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/\.?0+$/, "");
}
