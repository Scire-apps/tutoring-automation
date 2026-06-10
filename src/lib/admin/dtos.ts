/**
 * Server-side DTOs + PostgREST select constants for the `/api/admin/*` group
 * (§6.4 / §7.2). The admin panel is cross-org and platform-oriented: org rows
 * carry membership counts, accounts span every kind, sessions/subjects/approvals
 * mirror the manager shapes but are NOT org-scoped (RLS grants admin all rows via
 * `private.is_admin()`). Party + subject references are nested objects; audit
 * actors are flattened to a display name.
 */
import type { Database } from "@/types/database";

type OrgRow = Database["public"]["Tables"]["organizations"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type ApprovalRow = Database["public"]["Tables"]["subject_approvals"]["Row"];
type LedgerRow = Database["public"]["Tables"]["volunteer_hours_ledger"]["Row"];
type AuditRow = Database["public"]["Tables"]["audit_log"]["Row"];
type SubjectTemplateRow = Database["public"]["Tables"]["subject_templates"]["Row"];

export type PersonRef = { id: string; first_name: string; last_name: string; email?: string } | null;
export type SubjectRef = { id: string; name: string; category: string | null; grade_level: number | null };

/** Human display name from a party ref, or "" when null. */
export function refName(p: PersonRef): string {
  return p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() : "";
}

// --- Organizations -----------------------------------------------------------

/** Per-org membership counts the orgs list + detail header carry (§6.3). */
export type OrgCounts = {
  members: number;
  managers: number;
  pending: number;
};

/** An org row for the admin orgs list/detail (§6.3): identity + archive + counts. */
export type AdminOrgDTO = {
  id: string;
  name: string;
  slug: string;
  archived_at: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  member_count: number;
  manager_count: number;
  pending_count: number;
};

export function toAdminOrgDTO(o: OrgRow, counts: OrgCounts): AdminOrgDTO {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    archived_at: o.archived_at,
    is_archived: o.archived_at != null,
    created_at: o.created_at,
    updated_at: o.updated_at,
    member_count: counts.members,
    manager_count: counts.managers,
    pending_count: counts.pending,
  };
}

/** Full platform-level stats for one org (`GET /api/admin/orgs/[id]/stats`). */
export type AdminOrgStats = {
  members_active: number;
  members_pending: number;
  members_suspended: number;
  members_rejected: number;
  managers_active: number;
  managers_pending: number;
  open_sessions: number;
  scheduled_sessions: number;
  awaiting_verification: number;
  verified_sessions: number;
  subjects_active: number;
  total_hours_awarded: number;
};

// --- Accounts (unified members + managers + admins) --------------------------

/** An account row for the unified directory (`GET /api/admin/accounts`). */
export type AdminAccountDTO = {
  id: string;
  kind: Database["public"]["Enums"]["account_kind"];
  status: Database["public"]["Enums"]["account_status"];
  first_name: string;
  last_name: string;
  email: string;
  grade: number | null;
  pronouns: string | null;
  status_note: string | null;
  org: { id: string; name: string } | null;
  created_at: string;
  activated_at: string | null;
};

type ProfileWithOrg = ProfileRow & { org: { id: string; name: string } | null };

export const ACCOUNT_SELECT = `
  *,
  org:organizations!profiles_org_id_fkey ( id, name )
` as const;

export function toAdminAccountDTO(p: ProfileWithOrg): AdminAccountDTO {
  return {
    id: p.id,
    kind: p.kind,
    status: p.status,
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    grade: p.grade,
    pronouns: p.pronouns,
    status_note: p.status_note,
    org: p.org ?? null,
    created_at: p.created_at,
    activated_at: p.activated_at,
  };
}

/** A single account's subject-approval row (account detail, §6.4). */
export type AdminAccountApproval = {
  id: string;
  subject: SubjectRef;
  status: Database["public"]["Enums"]["approval_status"];
  evidence: string | null;
  decision_note: string | null;
  direct_grant: boolean;
  decided_at: string | null;
  created_at: string;
};

/** A single account's session summary row (account detail, §6.4). */
export type AdminAccountSession = {
  id: string;
  subject: SubjectRef;
  status: Database["public"]["Enums"]["session_status"];
  role: "requester" | "tutor";
  counterpart: PersonRef;
  scheduled_at: string | null;
  created_at: string;
};

/** Account detail (`GET /api/admin/accounts/[id]`): profile + approvals + sessions + hours. */
export type AdminAccountDetail = {
  account: AdminAccountDTO;
  total_hours: number;
  approvals: AdminAccountApproval[];
  sessions: AdminAccountSession[];
  counts: {
    approved_subjects: number;
    sessions_tutored: number;
    sessions_received: number;
  };
};

// --- Sessions ----------------------------------------------------------------

/** Hydrate a session with its subject + both party profiles + org (admin view). */
export const ADMIN_SESSION_SELECT = `
  *,
  org:organizations!sessions_org_id_fkey ( id, name ),
  subject:org_subjects!sessions_subject_fk ( id, name, category, grade_level ),
  requester:profiles!sessions_requester_fk ( id, first_name, last_name ),
  tutor:profiles!sessions_tutor_fk ( id, first_name, last_name )
` as const;

export type SessionWithJoins = SessionRow & {
  org: { id: string; name: string } | null;
  subject: SubjectRef | null;
  requester: PersonRef;
  tutor: PersonRef;
};

/** The admin-facing session shape (§6.4): org, both parties, subject, full lifecycle. */
export type AdminSessionDTO = {
  id: string;
  org: { id: string; name: string } | null;
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

const UNKNOWN_SUBJECT = (id: string): SubjectRef => ({ id, name: "Unknown subject", category: null, grade_level: null });

export function toAdminSessionDTO(row: SessionWithJoins): AdminSessionDTO {
  return {
    id: row.id,
    org: row.org ?? null,
    status: row.status,
    priority: row.priority,
    requester: row.requester,
    tutor: row.tutor,
    subject: row.subject ?? UNKNOWN_SUBJECT(row.org_subject_id),
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

// --- Subject approvals (override) --------------------------------------------

export const ADMIN_APPROVAL_SELECT = `
  *,
  org:organizations!subject_approvals_org_id_fkey ( id, name ),
  subject:org_subjects!subject_approvals_subject_fk ( id, name, category, grade_level ),
  member:profiles!subject_approvals_profile_fk ( id, first_name, last_name, email ),
  decider:profiles!subject_approvals_decided_by_fkey ( id, first_name, last_name )
` as const;

type ApprovalWithJoins = ApprovalRow & {
  org: { id: string; name: string } | null;
  subject: SubjectRef | null;
  member: PersonRef;
  decider: PersonRef;
};

/** The admin-facing approval shape (§6.4): org, member, subject, decision provenance. */
export type AdminApprovalDTO = {
  id: string;
  org: { id: string; name: string } | null;
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

export function toAdminApprovalDTO(row: ApprovalWithJoins): AdminApprovalDTO {
  return {
    id: row.id,
    org: row.org ?? null,
    status: row.status,
    member: row.member,
    subject: row.subject ?? UNKNOWN_SUBJECT(row.org_subject_id),
    evidence: row.evidence,
    decision_note: row.decision_note,
    direct_grant: row.direct_grant,
    decided_by: row.decider,
    decided_at: row.decided_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// --- Audit -------------------------------------------------------------------

/** A human-readable audit entry (viewer + session timeline): actor flattened, org named. */
export type AdminAuditDTO = {
  id: number;
  action: string;
  actor_name: string | null;
  actor_kind: Database["public"]["Enums"]["account_kind"] | null;
  org: { id: string; name: string } | null;
  target_table: string | null;
  target_id: string | null;
  metadata: AuditRow["metadata"];
  created_at: string;
};

type AuditWithJoins = AuditRow & {
  actor: PersonRef;
  org: { id: string; name: string } | null;
};

export const ADMIN_AUDIT_SELECT = `
  id, action, actor_kind, target_table, target_id, metadata, created_at,
  actor:profiles!audit_log_actor_id_fkey ( id, first_name, last_name ),
  org:organizations!audit_log_org_id_fkey ( id, name )
` as const;

export function toAdminAuditDTO(row: AuditWithJoins): AdminAuditDTO {
  const name = row.actor ? `${row.actor.first_name ?? ""} ${row.actor.last_name ?? ""}`.trim() : "";
  return {
    id: row.id,
    action: row.action,
    actor_name: name || null,
    actor_kind: row.actor_kind,
    org: row.org ?? null,
    target_table: row.target_table,
    target_id: row.target_id,
    metadata: row.metadata,
    created_at: row.created_at,
  };
}

// --- Subject template --------------------------------------------------------

/** A default-template subject row (`GET /api/admin/subject-template`). */
export type AdminTemplateDTO = {
  id: string;
  name: string;
  category: string | null;
  grade_level: number | null;
  created_at: string;
  updated_at: string;
};

export function toAdminTemplateDTO(t: SubjectTemplateRow): AdminTemplateDTO {
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    grade_level: t.grade_level,
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

/** Round a numeric hours total to 2 dp (the ledger SUM is the single source). */
export function roundHours(n: number): number {
  return Math.round(n * 100) / 100;
}

export type { ProfileWithOrg, ApprovalWithJoins, AuditWithJoins, SubjectTemplateRow };
export type LedgerHoursRow = Pick<LedgerRow, "hours">;
