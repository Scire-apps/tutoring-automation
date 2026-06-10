"use client";

/**
 * Canonical typed client for the `/api/admin/*` group (§6.4 / §7.9).
 *
 * The SINGLE source the whole admin UI consumes (overview, status, orgs, the
 * unified accounts namespace, subjects, subject-approvals, sessions, template,
 * audit). Every call is Bearer-authed through core's cookie-native session;
 * failures surface as `ApiError`. There is NO client cache for this group — admin
 * tables always read fresh (§6.4).
 *
 * Shapes: party + subject + org references are nested objects; `personName` /
 * `subjectLabel` / `orgName` compose the human strings. Lists use the shared
 * `{items,total,limit,offset}` envelope.
 */
import { get, post, patch, del } from "./core";
import { getBrowserClient } from "@/lib/supabase/client";
import type {
  AccountKind,
  AccountStatus,
  ApprovalStatus,
  LocationPreference,
  PriorityLevel,
  SessionStatus,
  ListEnvelope,
} from "@/types/api";

export type { ListEnvelope };

// --- Shared sub-shapes -------------------------------------------------------

/** A profile reference (the admin panel shows real names). */
export type PersonRef = { id: string; first_name: string; last_name: string; email?: string } | null;
/** The org-catalog subject triple embedded in admin rows. */
export type SubjectRef = { id: string; name: string; category: string | null; grade_level: number | null };
/** A minimal org reference embedded in cross-org rows. */
export type OrgRef = { id: string; name: string } | null;

/** Compose the human subject label from the triple ("Math · IB · Grade 11"). */
export function subjectLabel(s: SubjectRef | null | undefined): string {
  if (!s) return "—";
  const bits: string[] = [s.name];
  if (s.category) bits.push(s.category);
  if (s.grade_level != null) bits.push(`Grade ${s.grade_level}`);
  return bits.join(" · ");
}

/** Person display name from a profile ref ("Ada Lovelace"). */
export function personName(p: PersonRef): string {
  if (!p) return "—";
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—";
}

/** Org display name from an org ref, or a dash. */
export function orgName(o: OrgRef): string {
  return o?.name ?? "—";
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// --- Overview / status / session-start (§6.4) --------------------------------

export type AdminOverview = {
  stats: {
    orgs_active: number;
    orgs_archived: number;
    members_total: number;
    managers_total: number;
    admins_total: number;
    pending_members: number;
    pending_managers: number;
    open_sessions: number;
    awaiting_verification: number;
    total_hours_awarded: number;
  };
  recent_audit: AuditEntry[];
};

export type ServiceCheck = {
  name: "database" | "email" | "cron";
  status: "ok" | "degraded" | "down";
  detail: string;
};
export type AdminStatus = { overall: "ok" | "degraded" | "down"; checks: ServiceCheck[] };

export const getOverview = () => get<AdminOverview>("/api/admin/overview");
export const getStatus = () => get<AdminStatus>("/api/admin/status");

/** Record the admin.login audit row after a successful /admin-login (§6.1). */
export const sessionStart = () => post<{ ok: true }>("/api/admin/session-start", {});

// --- Audit (§6.4) ------------------------------------------------------------

export type AuditEntry = {
  id: number;
  action: string;
  actor_name: string | null;
  actor_kind: AccountKind | null;
  org: OrgRef;
  target_table: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AuditFilters = {
  org_id?: string;
  actor_id?: string;
  /** Exact action, or a dotted prefix ("session." → session.*). */
  action?: string;
  target_table?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export const listAudit = (filters: AuditFilters = {}) =>
  get<ListEnvelope<AuditEntry>>(`/api/admin/audit${buildQuery(filters)}`);

// --- Organizations (§6.3 / §6.4) ---------------------------------------------

export type AdminOrg = {
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

export type OrgStatusFilter = "active" | "archived" | "all";
export type ListOrgsParams = { status?: OrgStatusFilter; q?: string; limit?: number; offset?: number };

export const listOrgs = (params: ListOrgsParams = {}) => {
  const { status, ...rest } = params;
  return get<ListEnvelope<AdminOrg>>(
    `/api/admin/orgs${buildQuery({ ...rest, status: status === "all" ? undefined : status })}`,
  );
};

export const getOrg = (id: string) => get<AdminOrg>(`/api/admin/orgs/${id}`);
export const getOrgStats = (id: string) => get<AdminOrgStats>(`/api/admin/orgs/${id}/stats`);

export type CreateOrgInput = {
  name: string;
  slug?: string;
  /** "all" keeps every template subject; an id array deactivates the unchecked ones. */
  seed_subject_ids?: "all" | string[];
};
export const createOrg = (input: CreateOrgInput) => post<AdminOrg>("/api/admin/orgs", input);

export const updateOrg = (id: string, input: { name?: string; slug?: string }) =>
  patch<AdminOrg>(`/api/admin/orgs/${id}`, input);

export const archiveOrg = (id: string) => post<AdminOrg>(`/api/admin/orgs/${id}/archive`, {});
export const restoreOrg = (id: string) => post<AdminOrg>(`/api/admin/orgs/${id}/restore`, {});

/** DB-level backstop only (the UI exposes archive). 204 if empty, else 409 org_not_empty. */
export const deleteOrg = (id: string) => del<void>(`/api/admin/orgs/${id}`);

// --- Org subjects (shared row components with the manager panel) -------------

export type AdminSubject = {
  id: string;
  org_id: string;
  name: string;
  category: string | null;
  grade_level: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  open_sessions?: number;
  approved_members?: number;
};

export type SubjectInput = { name: string; category?: string | null; grade_level?: number | null };

/** An org's subject catalog (flat `?org_id` variant; pass includeUsage for counts). */
export const listOrgSubjects = (orgId: string, params: { includeUsage?: boolean; q?: string } = {}) =>
  get<ListEnvelope<AdminSubject>>(
    `/api/admin/subjects${buildQuery({ org_id: orgId, include: params.includeUsage ? "usage" : undefined, q: params.q })}`,
  );

export const createOrgSubject = (orgId: string, input: SubjectInput) =>
  post<AdminSubject>("/api/admin/subjects", { org_id: orgId, ...input });

export const updateSubject = (id: string, input: Partial<SubjectInput> & { active?: boolean }) =>
  patch<AdminSubject>(`/api/admin/subjects/${id}`, input);

export const archiveSubject = (id: string) => patch<AdminSubject>(`/api/admin/subjects/${id}`, { active: false });
export const reactivateSubject = (id: string) => patch<AdminSubject>(`/api/admin/subjects/${id}`, { active: true });

/** Soft-deactivates when referenced; 204 on a clean hard delete. */
export const deleteSubject = (id: string) => del<void>(`/api/admin/subjects/${id}`);

// --- Accounts (unified members + managers + admins, §6.4) --------------------

export type AdminAccount = {
  id: string;
  kind: AccountKind;
  status: AccountStatus;
  first_name: string;
  last_name: string;
  email: string;
  grade: number | null;
  pronouns: string | null;
  status_note: string | null;
  org: OrgRef;
  created_at: string;
  activated_at: string | null;
};

export type AdminAccountApproval = {
  id: string;
  subject: SubjectRef;
  status: ApprovalStatus;
  evidence: string | null;
  decision_note: string | null;
  direct_grant: boolean;
  decided_at: string | null;
  created_at: string;
};

export type AdminAccountSession = {
  id: string;
  subject: SubjectRef;
  status: SessionStatus;
  role: "requester" | "tutor";
  counterpart: PersonRef;
  scheduled_at: string | null;
  created_at: string;
};

export type AdminAccountDetail = {
  account: AdminAccount;
  total_hours: number;
  approvals: AdminAccountApproval[];
  sessions: AdminAccountSession[];
  counts: { approved_subjects: number; sessions_tutored: number; sessions_received: number };
};

export type ListAccountsParams = {
  kind?: AccountKind;
  status?: AccountStatus;
  org_id?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export const listAccounts = (params: ListAccountsParams = {}) =>
  get<ListEnvelope<AdminAccount>>(`/api/admin/accounts${buildQuery(params)}`);

export const getAccount = (id: string) => get<AdminAccountDetail>(`/api/admin/accounts/${id}`);

/** Admit a pending MEMBER → active (admin override; 409 wrong_kind if not a member). */
export const admitAccount = (id: string) => post<AdminAccount>(`/api/admin/accounts/${id}/admit`, {});

/** Activate a pending MANAGER → active (409 wrong_kind if not a manager). */
export const approveAccount = (id: string) => post<AdminAccount>(`/api/admin/accounts/${id}/approve`, {});

/** Reject a pending member/manager → rejected (+ note → status_note; account retained). */
export const rejectAccount = (id: string, body: { note?: string } = {}) =>
  post<AdminAccount>(`/api/admin/accounts/${id}/reject`, body);

/** Suspend an active member/manager → suspended (+ note → status_note). */
export const suspendAccount = (id: string, body: { note?: string } = {}) =>
  post<AdminAccount>(`/api/admin/accounts/${id}/suspend`, body);

/** Restore a suspended/rejected account → active. */
export const restoreAccount = (id: string) => post<AdminAccount>(`/api/admin/accounts/${id}/restore`, {});

/** A signed, nonzero hours adjustment for a member (reason required; 409 wrong_kind otherwise). */
export const adjustAccountHours = (id: string, body: { delta_hours: number; note: string }) =>
  post<{ id: number; profile_id: string; kind: "adjustment"; hours: number; note: string }>(
    `/api/admin/accounts/${id}/adjust-hours`,
    body,
  );

/** Delete a pending|rejected account (frees the email for re-invite). 204 on success. */
export const deleteAccount = (id: string) => del<void>(`/api/admin/accounts/${id}`);

export type InviteManagerInput = {
  email: string;
  first_name: string;
  last_name: string;
  org_id: string;
};

/** Invite a manager (admin-only; trigger creates pending → route promotes to active). */
export const inviteManager = (input: InviteManagerInput) =>
  post<{ id: string; email: string; kind: "manager"; status: "active"; org_id: string }>(
    "/api/admin/accounts/invite",
    { kind: "manager", ...input },
  );

// --- Subject approvals (override, §6.4) --------------------------------------

export type AdminApproval = {
  id: string;
  org: OrgRef;
  status: ApprovalStatus;
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

export type ListApprovalsParams = { org_id?: string; status?: ApprovalStatus; limit?: number; offset?: number };

export const listSubjectApprovals = (params: ListApprovalsParams = {}) =>
  get<ListEnvelope<AdminApproval>>(`/api/admin/subject-approvals${buildQuery(params)}`);

/** Decide a pending approval as an admin override: approve | reject (+ optional note). */
export const decideApproval = (id: string, body: { action: "approve" | "reject"; note?: string | null }) =>
  post<AdminApproval>(`/api/admin/subject-approvals/${id}/decide`, body);

// --- Sessions (oversight, §6.4) ----------------------------------------------

export type AdminSession = {
  id: string;
  org: OrgRef;
  status: SessionStatus;
  priority: PriorityLevel;
  requester: PersonRef;
  tutor: PersonRef;
  subject: SubjectRef;
  language: string | null;
  location_preference: LocationPreference;
  notes: string;
  availability: Record<string, string[]> | null;
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

export type AdminSessionDetail = { session: AdminSession; timeline: AuditEntry[] };

export type ListSessionsParams = { org_id?: string; status?: SessionStatus[]; q?: string; limit?: number; offset?: number };

export const listSessions = (params: ListSessionsParams = {}) => {
  const sp = new URLSearchParams();
  if (params.org_id) sp.set("org_id", params.org_id);
  for (const s of params.status ?? []) sp.append("status", s);
  if (params.q) sp.set("q", params.q);
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  const s = sp.toString();
  return get<ListEnvelope<AdminSession>>(`/api/admin/sessions${s ? `?${s}` : ""}`);
};

export const getSession = (id: string) => get<AdminSessionDetail>(`/api/admin/sessions/${id}`);

/** Cancel any non-terminal session → cancelled (reason required; org check bypassed). */
export const cancelSession = (id: string, body: { reason: string }) =>
  post<AdminSession>(`/api/admin/sessions/${id}/cancel`, body);

/** Verify completed|needs_changes → verified (awarded_hours; the trigger awards). */
export const verifySession = (id: string, body: { awarded_hours: number; note?: string | null }) =>
  post<AdminSession>(`/api/admin/sessions/${id}/verify`, body);

// --- Subject template (§6.4) -------------------------------------------------

export type AdminTemplate = {
  id: string;
  name: string;
  category: string | null;
  grade_level: number | null;
  created_at: string;
  updated_at: string;
};

export type TemplateInput = { name: string; category?: string | null; grade_level?: number | null };

export const listTemplate = (params: { q?: string; limit?: number; offset?: number } = {}) =>
  get<ListEnvelope<AdminTemplate>>(`/api/admin/subject-template${buildQuery(params)}`);

export const createTemplate = (input: TemplateInput) => post<AdminTemplate>("/api/admin/subject-template", input);

export const updateTemplate = (id: string, input: Partial<TemplateInput>) =>
  patch<AdminTemplate>(`/api/admin/subject-template/${id}`, input);

export const deleteTemplate = (id: string) => del<void>(`/api/admin/subject-template/${id}`);

// --- CSV-free helper: a fresh session token for ad-hoc fetches ---------------

/** Bearer token for ad-hoc authed fetches (parity with the manage export helper). */
export async function bearerToken(): Promise<string | null> {
  const { data } = await getBrowserClient().auth.getSession();
  return data.session?.access_token ?? null;
}
