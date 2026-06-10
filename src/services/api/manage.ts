"use client";

/**
 * Typed client for the `/api/manage/*` group (§7.9, §5). Bearer-authed via core's
 * cookie-native session; errors surface as `ApiError`. org_id is ALWAYS
 * server-derived from the caller's profile — it is never a parameter here (§5.0).
 *
 * --- SEAM NOTE (S4) ---------------------------------------------------------
 * This module is the CLIENT contract the manager-UI pages consume. It is the
 * mirror of the `/api/manage/*` server route shapes built by the S4 API
 * developer. As with `member.ts`, the DTOs below are FLATTENED conveniences for
 * the UI (subject triple fields inline so `subjectLabel()` reads them; party
 * refs as `{id, first_name, last_name}`); the server may return nested objects.
 * The reviewer reconciles any server↔client shape drift in one place (here),
 * exactly as it did for member.ts. Every call maps to the §7.2 manage endpoint
 * named in its doc-comment.
 */
import { get, post, patch } from "./core";
import type {
  AccountStatus,
  ApprovalStatus,
  LedgerKind,
  PriorityLevel,
  SessionStatus,
} from "@/types/api";

// --- Shared sub-shapes -------------------------------------------------------

/** A profile reference (the manager panel always shows real names). */
export type PersonRef = { id: string; first_name: string; last_name: string; email?: string } | null;

/** The subject triple, inlined so display helpers compose the label directly. */
export type SubjectTriple = {
  name: string;
  category: string | null;
  grade_level: number | null;
};

/** Standard paginated list envelope. */
export type ListEnvelope<T> = { items: T[]; total: number; limit: number; offset: number };

// --- Counts + overview (§5.3, §5.4) -----------------------------------------

/** The five sidebar badge counts (`GET /api/manage/counts`). */
export type ManageCounts = {
  pending_admissions: number;
  approval_requests: number;
  verification_queue: number;
  pending_managers: number;
  open_help: number;
};

/** A row in a "Needs attention" strip (overview). */
export type ManageAttentionItem = {
  /** The entity id the inline action targets (member id, approval id, session id…). */
  id: string;
  title: string;
  subtitle?: string | null;
};

/** A human-readable audit row (overview + member approval history). */
export type AuditEntry = {
  id: number;
  action: string;
  actor_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

/** The overview aggregate (`GET /api/manage/overview`). */
export type ManageOverview = {
  stats: {
    active_members: number;
    pending_admissions: number;
    open_requests: number;
    scheduled: number;
    awaiting_verification: number;
    total_hours_awarded: number;
  };
  attention: {
    admissions: ManageAttentionItem[];
    approvals: ManageAttentionItem[];
    verification: ManageAttentionItem[];
    managers: ManageAttentionItem[];
    help: ManageAttentionItem[];
  };
  recent_audit: AuditEntry[];
};

/** Sidebar badge counts — never cached (polled). */
export const getCounts = () => get<ManageCounts>("/api/manage/counts");

/** Overview aggregate. */
export const getOverview = () => get<ManageOverview>("/api/manage/overview");

// --- Members (§5.5) ----------------------------------------------------------

/** Directory status filter: the four statuses plus "all". */
export type ManageMemberStatusFilter = AccountStatus | "all";

/** A member directory row (`GET /api/manage/members`). */
export type ManageMemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: AccountStatus;
  grade: number | null;
  pronouns: string | null;
  approved_subjects_count: number;
  /** Ledger SUM (no cached counter). */
  total_hours: number;
  /** Open tutoring requests this member owns (drives the suspend cascade copy). */
  open_requests_count: number;
  /** In-flight sessions involving this member (claimed → scheduled). */
  active_sessions_count: number;
  created_at: string;
};

/** Full member detail (`GET /api/manage/members/[id]`). */
export type ManageMemberDetail = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: AccountStatus;
  grade: number | null;
  pronouns: string | null;
  status_note: string | null;
  total_hours: number;
  open_requests_count: number;
  active_sessions_count: number;
  created_at: string;
};

/** A member's subject-approval row (flat triple + decided-by name). */
export type ManageMemberApproval = {
  id: string;
  org_subject_id: string;
  name: string;
  category: string | null;
  grade_level: number | null;
  status: ApprovalStatus;
  evidence: string | null;
  decision_note: string | null;
  direct_grant: boolean;
  decided_by_name: string | null;
  decided_at: string | null;
  created_at: string;
};

/** A member's session row (as requester or tutor), flat. */
export type ManageMemberSession = {
  id: string;
  name: string;
  category: string | null;
  grade_level: number | null;
  status: SessionStatus;
  priority: PriorityLevel;
  /** The member's role in THIS session. */
  role: "requester" | "tutor";
  /** The other party (the tutor when role=requester, and vice-versa). */
  counterpart: PersonRef;
  scheduled_at: string | null;
  created_at: string;
};

/** A volunteer-hours ledger entry (award or adjustment), flat. */
export type ManageLedgerEntry = {
  id: number;
  kind: LedgerKind;
  hours: number;
  note: string | null;
  session_id: string | null;
  awarded_by_name: string | null;
  created_at: string;
};

export type MemberHoursResponse = {
  total_hours: number;
  items: ManageLedgerEntry[];
  total: number;
  limit: number;
  offset: number;
};

export type ListMembersParams = {
  status?: ManageMemberStatusFilter;
  q?: string;
  /** Admissions queue sorts oldest-first; the directory defaults newest-first. */
  order?: "newest" | "oldest";
  limit?: number;
  offset?: number;
};

/** The members directory, filtered + paginated. */
export const listMembers = (params: ListMembersParams = {}) => {
  const q = new URLSearchParams();
  if (params.status && params.status !== "all") q.set("status", params.status);
  if (params.q) q.set("q", params.q);
  if (params.order) q.set("order", params.order);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  const qs = q.toString();
  return get<ListEnvelope<ManageMemberRow>>(`/api/manage/members${qs ? `?${qs}` : ""}`);
};

/** One member's full detail. */
export const getMember = (id: string) => get<ManageMemberDetail>(`/api/manage/members/${id}`);

/** Admit a pending member → active (+ email). Optional welcome `note`. */
export const admitMember = (id: string, body: { note?: string } = {}) =>
  post<ManageMemberDetail>(`/api/manage/members/${id}/admit`, body);

/** Reject a pending member → rejected (+ email). `note` → member-visible status_note. */
export const rejectMember = (id: string, body: { note?: string } = {}) =>
  post<ManageMemberDetail>(`/api/manage/members/${id}/reject`, body);

/**
 * Suspend an active member → suspended (+ email). `cancel_active` cascade-cancels
 * their open requests + active sessions server-side; `note` → status_note.
 */
export const suspendMember = (
  id: string,
  body: { note?: string; cancel_active?: boolean },
) => post<ManageMemberDetail>(`/api/manage/members/${id}/suspend`, body);

/** Restore a suspended/rejected member → active (+ email). Clears status_note. */
export const restoreMember = (id: string) =>
  post<ManageMemberDetail>(`/api/manage/members/${id}/restore`);

/** A member's subject approvals (all states). */
export const getMemberApprovals = async (id: string): Promise<ManageMemberApproval[]> => {
  const { items } = await get<{ items: ManageMemberApproval[] }>(
    `/api/manage/members/${id}/approvals`,
  );
  return items;
};

/** The audit-timeline approval history for a member (per-subject decisions). */
export const getMemberApprovalHistory = async (id: string): Promise<AuditEntry[]> => {
  const { items } = await get<{ items: AuditEntry[] }>(
    `/api/manage/members/${id}/approvals/history`,
  );
  return items;
};

/** A member's sessions (as requester AND tutor). */
export const getMemberSessions = async (id: string): Promise<ManageMemberSession[]> => {
  const { items } = await get<{ items: ManageMemberSession[] }>(
    `/api/manage/members/${id}/sessions`,
  );
  return items;
};

/** A member's volunteer-hours ledger (total + entries). */
export const getMemberHours = (id: string) =>
  get<MemberHoursResponse>(`/api/manage/members/${id}/hours`);

/** Add a signed, nonzero ledger adjustment for a member (reason required). */
export const adjustMemberHours = (id: string, body: { delta_hours: number; note: string }) =>
  post<ManageLedgerEntry>(`/api/manage/hours/adjustments`, { member_id: id, ...body });

// --- Subject approvals (§5.6) ------------------------------------------------

/** A pending approval request awaiting a decision (flat triple + member ref). */
export type ManageApprovalRequest = {
  id: string;
  member: PersonRef;
  name: string;
  category: string | null;
  grade_level: number | null;
  evidence: string | null;
  created_at: string;
};

/** An approved member for a given subject (By-subject tab). */
export type ManageSubjectApprovedMember = {
  approval_id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  direct_grant: boolean;
  decided_at: string | null;
};

/** Pending tutoring-approval requests, paginated. */
export const listApprovalRequests = (params: { limit?: number; offset?: number } = {}) => {
  const q = new URLSearchParams();
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  const qs = q.toString();
  return get<ListEnvelope<ManageApprovalRequest>>(
    `/api/manage/subject-approvals${qs ? `?${qs}` : ""}`,
  );
};

/** Decide a pending request: approve | reject (+ optional decision_note). */
export const decideApproval = (
  id: string,
  body: { decision: "approve" | "reject"; decision_note?: string },
) => post<ManageMemberApproval>(`/api/manage/subject-approvals/${id}/decide`, body);

/** Directly grant a member approval for a subject (direct grant, evidence NULL). */
export const grantSubject = (body: { member_id: string; subject_id: string }) =>
  post<ManageMemberApproval>("/api/manage/subject-approvals", body);

/** Revoke an approved grant → revoked (+ audit). */
export const revokeApproval = (id: string, body: { note?: string } = {}) =>
  post<ManageMemberApproval>(`/api/manage/subject-approvals/${id}/revoke`, body);

/** Approved members for one subject (By-subject tab). */
export const listApprovedMembersForSubject = async (
  orgSubjectId: string,
): Promise<ManageSubjectApprovedMember[]> => {
  const { items } = await get<{ items: ManageSubjectApprovedMember[] }>(
    `/api/manage/subject-approvals?subject_id=${orgSubjectId}&status=approved`,
  );
  return items;
};

// --- Org subjects (catalog, read for pickers — §5.11 owns the CRUD page) -----

/** An org catalog subject (flat triple). */
export type ManageOrgSubject = {
  id: string;
  name: string;
  category: string | null;
  grade_level: number | null;
  active: boolean;
};

/** The org subject catalog (used by the grant / by-subject pickers). */
export const listOrgSubjects = async (
  params: { active?: boolean } = {},
): Promise<ManageOrgSubject[]> => {
  const q = new URLSearchParams();
  if (params.active != null) q.set("active", params.active ? "1" : "0");
  const qs = q.toString();
  const { items } = await get<{ items: ManageOrgSubject[] }>(
    `/api/manage/subjects${qs ? `?${qs}` : ""}`,
  );
  return items;
};

// --- Managers (§5.7) ---------------------------------------------------------

/** A manager row (my org only). */
export type ManageManagerRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: AccountStatus;
  created_at: string;
};

/** Managers for my org (pending + active). */
export const listManagers = async (): Promise<ManageManagerRow[]> => {
  const { items } = await get<{ items: ManageManagerRow[] }>("/api/manage/managers");
  return items;
};

/** Decide a pending manager: approve → active (+email) | reject → rejected (+email). */
export const decideManager = (id: string, body: { decision: "approve" | "reject" }) =>
  patch<ManageManagerRow>(`/api/manage/managers/${id}`, body);
