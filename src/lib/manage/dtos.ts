/**
 * Server-side DTOs + PostgREST select constants for the `/api/manage/*` group
 * (§5 / §7.2). A manager is never a party to a session/approval, so these shapes
 * are org-administrator-oriented: both parties by name, the subject triple, the
 * full lifecycle, and (for the detail view) the audit timeline. Joins ride the
 * composite FKs on the manager's RLS-bound client (managed_org scoping applies).
 */
import type { Database } from "@/types/database";

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type ApprovalRow = Database["public"]["Tables"]["subject_approvals"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type LedgerRow = Database["public"]["Tables"]["volunteer_hours_ledger"]["Row"];
type AuditRow = Database["public"]["Tables"]["audit_log"]["Row"];

export type PersonRef = { id: string; first_name: string; last_name: string; email?: string } | null;
export type SubjectRef = { id: string; name: string; category: string | null; grade_level: number | null };

/** Human display name from a party ref, or "" when null (UI helper mirror). */
export function refName(p: PersonRef): string {
  return p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() : "";
}

// --- Sessions ----------------------------------------------------------------

/** Hydrate a session with its subject + both party profiles (manager view). */
export const MANAGE_SESSION_SELECT = `
  *,
  subject:org_subjects!sessions_subject_fk ( id, name, category, grade_level ),
  requester:profiles!sessions_requester_fk ( id, first_name, last_name ),
  tutor:profiles!sessions_tutor_fk ( id, first_name, last_name )
` as const;

export type SessionWithJoins = SessionRow & {
  subject: SubjectRef | null;
  requester: PersonRef;
  tutor: PersonRef;
};

/** The manager-facing session shape (§5.8): both parties, subject, full lifecycle. */
export type ManageSessionDTO = {
  id: string;
  status: Database["public"]["Enums"]["session_status"];
  priority: Database["public"]["Enums"]["priority_level"];
  requester: PersonRef;
  tutor: PersonRef;
  subject: SubjectRef;
  language: string | null;
  location_preference: Database["public"]["Enums"]["location_preference"];
  notes: string;
  availability: SessionRow["availability"];
  duration_minutes: number | null;
  scheduled_at: string | null;
  location: string | null;
  recording_url: string | null;
  completed_at: string | null;
  verification_note: string | null;
  awarded_hours: number | null;
  verified_at: string | null;
  verified_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
};

export function toManageSessionDTO(row: SessionWithJoins): ManageSessionDTO {
  return {
    id: row.id,
    status: row.status,
    priority: row.priority,
    requester: row.requester,
    tutor: row.tutor,
    subject: row.subject ?? { id: row.org_subject_id, name: "Unknown subject", category: null, grade_level: null },
    language: row.language,
    location_preference: row.location_preference,
    notes: row.notes,
    availability: row.availability,
    duration_minutes: row.duration_minutes,
    scheduled_at: row.scheduled_at,
    location: row.location,
    recording_url: row.recording_url,
    completed_at: row.completed_at,
    verification_note: row.verification_note,
    awarded_hours: row.awarded_hours,
    verified_at: row.verified_at,
    verified_by: row.verified_by,
    cancelled_at: row.cancelled_at,
    cancelled_by: row.cancelled_by,
    cancelled_reason: row.cancelled_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * A human-readable audit entry for the overview feed + session timeline
 * (§5.4 / §5.8). The actor is FLATTENED to a display name (`actor_name`) — the UI
 * renders strings, never the nested profile ref.
 */
export type AuditEntryDTO = {
  id: number;
  action: string;
  actor_name: string | null;
  actor_kind: Database["public"]["Enums"]["account_kind"] | null;
  target_table: string | null;
  target_id: string | null;
  metadata: AuditRow["metadata"];
  created_at: string;
};

type AuditWithActor = AuditRow & { actor: PersonRef };

export const AUDIT_SELECT = `
  id, action, actor_kind, target_table, target_id, metadata, created_at,
  actor:profiles!audit_log_actor_id_fkey ( id, first_name, last_name )
` as const;

export function toAuditEntryDTO(row: AuditWithActor): AuditEntryDTO {
  const name = row.actor ? `${row.actor.first_name ?? ""} ${row.actor.last_name ?? ""}`.trim() : "";
  return {
    id: row.id,
    action: row.action,
    actor_name: name || null,
    actor_kind: row.actor_kind,
    target_table: row.target_table,
    target_id: row.target_id,
    metadata: row.metadata,
    created_at: row.created_at,
  };
}

// --- Subject approvals -------------------------------------------------------

export const MANAGE_APPROVAL_SELECT = `
  *,
  subject:org_subjects!subject_approvals_subject_fk ( id, name, category, grade_level ),
  member:profiles!subject_approvals_profile_fk ( id, first_name, last_name, email ),
  decider:profiles!subject_approvals_decided_by_fkey ( id, first_name, last_name )
` as const;

type ApprovalWithJoins = ApprovalRow & {
  subject: SubjectRef | null;
  member: PersonRef;
  decider: PersonRef;
};

/** The manager-facing approval shape (§5.6): member, subject, decision provenance. */
export type ManageApprovalDTO = {
  id: string;
  status: Database["public"]["Enums"]["approval_status"];
  member: PersonRef;
  subject: SubjectRef;
  evidence: string | null;
  decision_note: string | null;
  direct_grant: boolean;
  decided_by: PersonRef;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

export function toManageApprovalDTO(row: ApprovalWithJoins): ManageApprovalDTO {
  return {
    id: row.id,
    status: row.status,
    member: row.member,
    subject: row.subject ?? { id: row.org_subject_id, name: "Unknown subject", category: null, grade_level: null },
    evidence: row.evidence,
    decision_note: row.decision_note,
    direct_grant: row.direct_grant,
    decided_by: row.decider,
    decided_at: row.decided_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// --- Members -----------------------------------------------------------------

/** Per-member activity counts the directory + detail carry (§5.5). */
export type MemberCounts = {
  approved_subjects: number;
  hours_total: number;
  open_requests: number;
  active_sessions: number;
};

/** A member directory row (§5.5): profile + derived counts (UI field names). */
export type ManageMemberDTO = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  grade: number | null;
  pronouns: string | null;
  status: Database["public"]["Enums"]["account_status"];
  status_note: string | null;
  approved_subjects_count: number;
  total_hours: number;
  open_requests_count: number;
  active_sessions_count: number;
  created_at: string;
  activated_at: string | null;
};

/** Shape a profile row into the directory DTO with its aggregate counts. */
export function toManageMemberDTO(p: ProfileRow, counts: MemberCounts): ManageMemberDTO {
  return {
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    grade: p.grade,
    pronouns: p.pronouns,
    status: p.status,
    status_note: p.status_note,
    approved_subjects_count: counts.approved_subjects,
    total_hours: roundHours(counts.hours_total),
    open_requests_count: counts.open_requests,
    active_sessions_count: counts.active_sessions,
    created_at: p.created_at,
    activated_at: p.activated_at,
  };
}

/** A manager directory row (§5.7): identity + status, no member-only fields. */
export type ManageManagerDTO = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: Database["public"]["Enums"]["account_status"];
  created_at: string;
  activated_at: string | null;
};

export function toManageManagerDTO(p: ProfileRow): ManageManagerDTO {
  return {
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    status: p.status,
    created_at: p.created_at,
    activated_at: p.activated_at,
  };
}

// --- Hours -------------------------------------------------------------------

/**
 * A ledger row for the hours tabs (§5.10): signed delta, kind, session, note. The
 * member is nested; the awarder + the award's subject are flattened to display
 * names (`awarded_by_name`, `subject_name`) — the UI renders strings.
 */
export type LedgerEntryDTO = {
  id: number;
  profile_id: string;
  member: PersonRef;
  kind: Database["public"]["Enums"]["ledger_kind"];
  hours: number;
  note: string | null;
  session_id: string | null;
  awarded_by_name: string | null;
  subject_name: string | null;
  created_at: string;
};

type LedgerWithJoins = LedgerRow & {
  member: PersonRef;
  awarder: PersonRef;
  session: { org_subject: { name: string } | null } | null;
};

export const LEDGER_SELECT = `
  *,
  member:profiles!volunteer_hours_ledger_profile_fk ( id, first_name, last_name ),
  awarder:profiles!volunteer_hours_ledger_awarded_by_fkey ( id, first_name, last_name ),
  session:sessions!volunteer_hours_ledger_session_id_fkey ( org_subject:org_subjects!sessions_subject_fk ( name ) )
` as const;

export function toLedgerEntryDTO(row: LedgerWithJoins): LedgerEntryDTO {
  return {
    id: row.id,
    profile_id: row.profile_id,
    member: row.member,
    kind: row.kind,
    hours: Number(row.hours),
    note: row.note,
    session_id: row.session_id,
    awarded_by_name: refName(row.awarder) || null,
    subject_name: row.session?.org_subject?.name ?? null,
    created_at: row.created_at,
  };
}

/** Round a numeric hours total to 2 dp (the ledger SUM is the single source). */
export function roundHours(n: number): number {
  return Math.round(n * 100) / 100;
}

export type { ApprovalWithJoins, AuditWithActor, LedgerWithJoins };
