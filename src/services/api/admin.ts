"use client";

/**
 * Canonical typed client for the `/api/admin/*` group (§6.4 / §7.2).
 *
 * The SINGLE source the whole admin panel consumes (dashboard, orgs, org detail,
 * managers, members, sessions, template, audit, admins, security). Every call is
 * Bearer-authed through core's cookie-native session; failures surface as
 * `ApiError`. Admins are cross-org: `org_id` is an explicit FILTER here (not
 * server-derived as in the manage client), and RLS grants the breadth via
 * `private.is_admin()`.
 *
 * SEAM: devA owns the `/api/admin/*` route handlers (S5 devA). This module is the
 * UI-consensus superset of what the admin pages read — it mirrors the §6.4/§7.2
 * endpoint inventory verbatim. The reviewer reconciles devA's response shapes
 * against the DTOs declared here (the same posture S4 used for the manage client).
 */
import { get, post, patch, del } from "./core";
import { getBrowserClient } from "@/lib/supabase/client";
import type {
  AccountKind,
  AccountStatus,
  ApprovalStatus,
  LedgerKind,
  LocationPreference,
  PriorityLevel,
  SessionStatus,
  ServiceState,
  ListEnvelope,
  OrgRef,
} from "@/types/api";

export type { ListEnvelope };

// --- Shared sub-shapes -------------------------------------------------------

/** A profile reference (the admin panel always shows real names). */
export type PersonRef = {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
} | null;

/** A subject triple embedded in admin rows (org catalog or template). */
export type SubjectRef = {
  id: string;
  name: string;
  category: string | null;
  grade_level: number | null;
};

/** Compose the human subject label from the triple ("Math · IB · Grade 11"). */
export function subjectLabel(
  s: { name: string; category: string | null; grade_level: number | null } | null | undefined,
): string {
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

/** Build a `?a=b&c=d` query string, dropping empty/nullish values. */
function buildQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// --- Platform overview / status / audit (§6.4) -------------------------------

/** Platform stat cards (`GET /api/admin/overview`). */
export type AdminOverview = {
  stats: {
    organizations: number;
    active_organizations: number;
    members: number;
    active_members: number;
    managers: number;
    pending_managers: number;
    sessions: number;
    awaiting_verification: number;
    hours_awarded: number;
  };
  recent_audit: AdminAuditEntry[];
};

/** One dependency's health row inside the service-status payload. */
export type ServiceCheck = { name: string; status: ServiceState; detail?: string | null };

/** Service health (`GET /api/admin/status`). */
export type AdminStatus = {
  status: ServiceState;
  checks: ServiceCheck[];
};

/** A human-readable audit row (dashboard + the audit viewer). */
export type AdminAuditEntry = {
  id: number;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_kind: AccountKind | null;
  org_id: string | null;
  org_name: string | null;
  target_table: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AuditFilters = {
  org_id?: string;
  actor_id?: string;
  action?: string;
  target_type?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export const getOverview = () => get<AdminOverview>("/api/admin/overview");
export const getStatus = () => get<AdminStatus>("/api/admin/status");

/** The filterable audit viewer (§6.3 audit). */
export const listAudit = (filters: AuditFilters = {}) =>
  get<ListEnvelope<AdminAuditEntry>>(`/api/admin/audit${buildQuery({ ...filters })}`);

/** Record an `admin.login` audit event after a successful /admin-login (§6.1). */
export const sessionStart = () => post<{ ok: true }>("/api/admin/session-start", {});

// --- Organizations (§6.4) ----------------------------------------------------

/** An org list row with platform counts. */
export type AdminOrg = {
  id: string;
  name: string;
  slug: string;
  archived_at: string | null;
  created_at: string;
  members_count: number;
  managers_count: number;
  sessions_count: number;
};

/** Per-org statistics for the org-detail overview tab (`GET .../stats`). */
export type AdminOrgStats = {
  active_members: number;
  pending_members: number;
  active_managers: number;
  pending_managers: number;
  open_requests: number;
  scheduled: number;
  awaiting_verification: number;
  hours_awarded: number;
  subjects_active: number;
};

export type ListOrgsParams = {
  q?: string;
  /** "active" (default) hides archived orgs; "archived" / "all" widen it. */
  status?: "active" | "archived" | "all";
  limit?: number;
  offset?: number;
};

export type CreateOrgInput = {
  name: string;
  slug?: string;
  /** Template subject ids to copy, or 'all' (the dialog's "copy-all + soft-deactivate"). */
  seed_subject_ids?: string[] | "all";
};

export const listOrgs = (params: ListOrgsParams = {}) =>
  get<ListEnvelope<AdminOrg>>(`/api/admin/orgs${buildQuery({ ...params })}`);

export const getOrg = (id: string) => get<AdminOrg>(`/api/admin/orgs/${id}`);

export const getOrgStats = (id: string) => get<AdminOrgStats>(`/api/admin/orgs/${id}/stats`);

/** Create an org (copies the template via the create_organization RPC). */
export const createOrg = (input: CreateOrgInput) => post<AdminOrg>("/api/admin/orgs", input);

/** Rename / re-slug an org (§6.3 settings). */
export const updateOrg = (id: string, input: { name?: string; slug?: string }) =>
  patch<AdminOrg>(`/api/admin/orgs/${id}`, input);

/** Archive an org (soft; hidden from signup, panel read-only — §6.3). */
export const archiveOrg = (id: string) => post<AdminOrg>(`/api/admin/orgs/${id}/archive`, {});

/** Restore an archived org (re-validates the slug uniqueness). */
export const restoreOrg = (id: string) => post<AdminOrg>(`/api/admin/orgs/${id}/restore`, {});

// --- Org subjects (§6.4 — shared row components with the manager panel) -------

/** An org-catalog subject (flat triple + usage counts). */
export type AdminSubject = {
  id: string;
  org_id: string;
  name: string;
  category: string | null;
  grade_level: number | null;
  active: boolean;
  open_sessions?: number;
  approved_members?: number;
  created_at?: string;
};

export type SubjectInput = { name: string; category?: string | null; grade_level?: number | null };

/** An org's subject catalog (admin override; `?include=usage` for counts). */
export const listOrgSubjects = (orgId: string, params: { includeUsage?: boolean; q?: string } = {}) =>
  get<ListEnvelope<AdminSubject>>(
    `/api/admin/orgs/${orgId}/subjects${buildQuery({
      include: params.includeUsage ? "usage" : undefined,
      q: params.q,
    })}`,
  );

export const createOrgSubject = (orgId: string, input: SubjectInput) =>
  post<AdminSubject>(`/api/admin/orgs/${orgId}/subjects`, input);

export const updateOrgSubject = (
  orgId: string,
  subjectId: string,
  input: Partial<SubjectInput> & { active?: boolean },
) => patch<AdminSubject>(`/api/admin/orgs/${orgId}/subjects/${subjectId}`, input);

/** Soft-deactivate (archive) a referenced subject; hard-delete only if unreferenced. */
export const deleteOrgSubject = (orgId: string, subjectId: string) =>
  del<{ id: string }>(`/api/admin/orgs/${orgId}/subjects/${subjectId}`);

// --- Accounts (unified namespace — §6.4) -------------------------------------

/** A row in the unified accounts collection (members, managers, OR admins). */
export type AdminAccount = {
  id: string;
  kind: AccountKind;
  status: AccountStatus;
  first_name: string;
  last_name: string;
  email: string;
  org: OrgRef | null;
  grade: number | null;
  pronouns: string | null;
  status_note: string | null;
  total_hours: number;
  approved_subjects_count: number;
  open_requests_count: number;
  active_sessions_count: number;
  created_at: string;
};

/** Full account detail (profile + approvals + sessions summary). */
export type AdminAccountDetail = AdminAccount & {
  approvals: AdminAccountApproval[];
  sessions: AdminAccountSession[];
  ledger: AdminLedgerEntry[];
};

export type AdminAccountApproval = {
  id: string;
  org_subject_id: string;
  name: string;
  category: string | null;
  grade_level: number | null;
  status: ApprovalStatus;
  evidence: string | null;
  decision_note: string | null;
  direct_grant: boolean;
  decided_at: string | null;
  created_at: string;
};

export type AdminAccountSession = {
  id: string;
  name: string;
  category: string | null;
  grade_level: number | null;
  status: SessionStatus;
  role: "requester" | "tutor";
  counterpart: PersonRef;
  scheduled_at: string | null;
  created_at: string;
};

export type AdminLedgerEntry = {
  id: number;
  kind: LedgerKind;
  hours: number;
  note: string | null;
  session_id: string | null;
  awarded_by_name: string | null;
  created_at: string;
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
  get<ListEnvelope<AdminAccount>>(`/api/admin/accounts${buildQuery({ ...params })}`);

export const getAccount = (id: string) => get<AdminAccountDetail>(`/api/admin/accounts/${id}`);

/** Admit a pending MEMBER → active (admin override of a manager power). */
export const admitAccount = (id: string) =>
  post<AdminAccount>(`/api/admin/accounts/${id}/admit`, {});

/** Approve a pending MANAGER → active (+ activation email). */
export const approveAccount = (id: string) =>
  post<AdminAccount>(`/api/admin/accounts/${id}/approve`, {});

/** Reject a pending member/manager → rejected (+ email; account + auth user RETAINED). */
export const rejectAccount = (id: string, body: { note?: string } = {}) =>
  post<AdminAccount>(`/api/admin/accounts/${id}/reject`, body);

/** Suspend an active member/manager → suspended (+ email). */
export const suspendAccount = (id: string, body: { note?: string } = {}) =>
  post<AdminAccount>(`/api/admin/accounts/${id}/suspend`, body);

/** Restore a suspended/rejected account → active (+ email). */
export const restoreAccount = (id: string) =>
  post<AdminAccount>(`/api/admin/accounts/${id}/restore`, {});

/** Add a signed, nonzero ledger adjustment for a member (reason required). */
export const adjustAccountHours = (id: string, body: { delta_hours: number; note: string }) =>
  post<AdminLedgerEntry>(`/api/admin/accounts/${id}/adjust-hours`, body);

/**
 * Delete a pending|rejected account (`auth.admin.deleteUser` — frees the email
 * for re-invite). 409 `wrong_kind`/`invalid_state` if the account is active.
 */
export const deleteAccount = (id: string) => del<{ id: string }>(`/api/admin/accounts/${id}`);

/** Invite a manager for an org (service-role inviteUserByEmail → pending → active). */
export const inviteManager = (input: {
  email: string;
  first_name: string;
  last_name: string;
  org_id: string;
}) =>
  post<AdminAccount>("/api/admin/accounts/invite", { kind: "manager", ...input });

// --- Subject approvals (override) — §6.4 -------------------------------------

export type AdminSubjectApproval = {
  id: string;
  status: ApprovalStatus;
  member: PersonRef;
  subject: SubjectRef;
  org: OrgRef | null;
  evidence: string | null;
  decision_note: string | null;
  direct_grant: boolean;
  decided_at: string | null;
  created_at: string;
};

export const listSubjectApprovals = (
  params: { org_id?: string; status?: ApprovalStatus; limit?: number; offset?: number } = {},
) => get<ListEnvelope<AdminSubjectApproval>>(`/api/admin/subject-approvals${buildQuery({ ...params })}`);

export const decideSubjectApproval = (
  id: string,
  body: { decision: "approve" | "reject"; note?: string | null },
) =>
  post<AdminSubjectApproval>(`/api/admin/subject-approvals/${id}/${body.decision}`, {
    note: body.note ?? null,
  });

// --- Sessions (global oversight) — §6.4 --------------------------------------

/** A session row as seen by an admin — nested parties + subject + org. */
export type AdminSession = {
  id: string;
  status: SessionStatus;
  priority: PriorityLevel;
  requester: PersonRef;
  tutor: PersonRef;
  subject: SubjectRef;
  org: OrgRef | null;
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
  cancelled_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminSessionTimelineEntry = {
  id: number;
  action: string;
  actor_name: string | null;
  created_at: string;
};

export type AdminSessionDetail = { session: AdminSession; timeline: AdminSessionTimelineEntry[] };

export type AdminSessionFilters = {
  org_id?: string;
  status?: SessionStatus[];
  q?: string;
  limit?: number;
  offset?: number;
};

export const listSessions = (filters: AdminSessionFilters = {}) => {
  const sp = new URLSearchParams();
  if (filters.org_id) sp.set("org_id", filters.org_id);
  for (const s of filters.status ?? []) sp.append("status", s);
  if (filters.q) sp.set("q", filters.q);
  if (filters.limit != null) sp.set("limit", String(filters.limit));
  if (filters.offset != null) sp.set("offset", String(filters.offset));
  const s = sp.toString();
  return get<ListEnvelope<AdminSession>>(`/api/admin/sessions${s ? `?${s}` : ""}`);
};

export const getSession = (id: string) => get<AdminSessionDetail>(`/api/admin/sessions/${id}`);

/** Verify completed|needs_changes → verified (+ award; same trigger as the manager path). */
export const verifySession = (id: string, input: { awarded_hours: number; note?: string | null }) =>
  post<AdminSession>(`/api/admin/sessions/${id}/verify`, input);

/** Cancel any non-terminal session → cancelled (reason required, both parties emailed). */
export const cancelSession = (id: string, input: { reason: string }) =>
  post<AdminSession>(`/api/admin/sessions/${id}/cancel`, input);

// --- Subject template (default catalog) — §6.4 -------------------------------

export type TemplateSubject = {
  id: string;
  name: string;
  category: string | null;
  grade_level: number | null;
  created_at?: string;
};

export const listTemplate = (params: { q?: string; limit?: number; offset?: number } = {}) =>
  get<ListEnvelope<TemplateSubject>>(`/api/admin/subject-template${buildQuery({ ...params })}`);

export const createTemplateSubject = (input: SubjectInput) =>
  post<TemplateSubject>("/api/admin/subject-template", input);

export const updateTemplateSubject = (id: string, input: Partial<SubjectInput>) =>
  patch<TemplateSubject>(`/api/admin/subject-template/${id}`, input);

export const deleteTemplateSubject = (id: string) =>
  del<{ id: string }>(`/api/admin/subject-template/${id}`);

// --- CSV-less helpers --------------------------------------------------------

/** Current access token for direct fetches (none needed yet; reserved for exports). */
export async function accessToken(): Promise<string | null> {
  const { data } = await getBrowserClient().auth.getSession();
  return data.session?.access_token ?? null;
}
