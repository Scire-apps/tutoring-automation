"use client";

/**
 * Typed client for the `/api/manage/*` group (§7.9 / §5). Every call is
 * Bearer-authed via core's cookie-native session; errors surface as `ApiError`
 * (the manager UI maps `manager_not_active` → /api/auth/me refetch + gate). The
 * DTO types here are the client mirror of the server response shapes (§5 / §7.2)
 * — the cross-slice contract the manager UI consumes. org_id is NEVER passed
 * from the client; the server derives it from the caller's profile.
 *
 * Caching: lists/counts are NOT cached by default (manager screens mutate and
 * refetch); overview/counts may pass a short TTL at the call site if desired.
 */
import { get, post, patch } from "./core";
import { getBrowserClient } from "@/lib/supabase/client";
import type {
  AccountStatus,
  ApprovalStatus,
  LedgerKind,
  LocationPreference,
  PriorityLevel,
  SessionStatus,
  UrgencyLevel,
  ListEnvelope,
} from "@/types/api";

// --- Shared sub-shapes -------------------------------------------------------

export type PersonRef = { id: string; first_name: string; last_name: string } | null;
export type SubjectRef = { id: string; name: string; category: string | null; grade_level: number | null };

/** Compose the human subject label from the triple ("Math · IB · Grade 11"). */
export function subjectLabel(s: SubjectRef): string {
  const bits: string[] = [s.name];
  if (s.category) bits.push(s.category);
  if (s.grade_level != null) bits.push(`Grade ${s.grade_level}`);
  return bits.join(" · ");
}

/** Display name from a profile ref ("Ada Lovelace"), or "" when null. */
export function personName(p: PersonRef): string {
  if (!p) return "";
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
}

// --- Overview / counts (§5.3 / §5.4) -----------------------------------------

export type ManageCounts = {
  pending_members: number;
  pending_subject_approvals: number;
  completed_sessions: number;
  open_help: number;
  pending_managers: number;
};

export type AuditEntry = {
  id: number;
  action: string;
  actor: PersonRef;
  actor_kind: "member" | "manager" | "admin" | null;
  metadata: unknown;
  created_at: string;
};

export type ManageOverview = {
  org: { id: string };
  counts: ManageCounts;
  hours_awarded_total: number;
  recent_audit: AuditEntry[];
};

// --- Members (§5.5) ----------------------------------------------------------

export type ManageMember = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  grade: number | null;
  pronouns: string | null;
  status: AccountStatus;
  status_note: string | null;
  approved_subjects: number;
  hours_total: number;
  created_at: string;
  activated_at: string | null;
};

export type ManageApproval = {
  id: string;
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

export type ManageMemberDetail = {
  member: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    grade: number | null;
    pronouns: string | null;
    status: AccountStatus;
    status_note: string | null;
    created_at: string;
    activated_at: string | null;
  };
  approvals: ManageApproval[];
  approved_subjects: number;
  hours_total: number;
};

// --- Managers (§5.7) ---------------------------------------------------------

export type ManageManager = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: AccountStatus;
  created_at: string;
  activated_at: string | null;
};

// --- Subjects (§5.11) --------------------------------------------------------

export type ManageSubject = {
  id: string;
  org_id: string;
  name: string;
  category: string | null;
  grade_level: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  /** Present only when ?include=usage. */
  open_sessions?: number;
  approved_members?: number;
};

// --- Sessions (§5.8) ---------------------------------------------------------

export type ManageSession = {
  id: string;
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

export type ManageSessionDetail = {
  session: ManageSession;
  timeline: AuditEntry[];
};

// --- Hours (§5.10) -----------------------------------------------------------

export type MemberHoursTotal = {
  profile_id: string;
  first_name: string;
  last_name: string;
  email: string;
  total_hours: number;
};

export type LedgerEntry = {
  id: number;
  profile_id: string;
  member: PersonRef;
  kind: LedgerKind;
  hours: number;
  note: string | null;
  session_id: string | null;
  awarded_by: PersonRef;
  created_at: string;
};

// --- Emails (§5.12) ----------------------------------------------------------

export type BroadcastScope = "all_active" | "pending" | "subject" | "selected";

export type EmailBatchSummary = {
  batch_id: string;
  subject: string;
  sent_at: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
};

export type EmailBatchDetail = {
  batch_id: string;
  subject: string;
  body: string | null;
  sent_at: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  recipients: Array<{ recipient_email: string; recipient_id: string | null; status: "sent" | "failed" }>;
};

// --- Help (§5.13) ------------------------------------------------------------

export type HelpRequest = {
  id: string;
  member: PersonRef;
  urgency: UrgencyLevel;
  description: string;
  status: "open" | "resolved";
  resolved_at: string | null;
  created_at: string;
};

// --- Request bodies ----------------------------------------------------------

export type SuspendInput = { note?: string | null; cancel_active?: boolean };
export type DirectGrantInput = { member_id: string; org_subject_id: string; note?: string | null };
export type DecideApprovalInput = { action: "approve" | "reject"; note?: string | null };
export type CreateSubjectInput = { name: string; category?: string | null; grade_level?: number | null };
export type PatchSubjectInput = {
  name?: string;
  category?: string | null;
  grade_level?: number | null;
  active?: boolean;
};
export type VerifyInput = { hours: number; note?: string | null };
export type AdjustmentInput = { member_id: string; hours: number; note: string };
export type BroadcastInput = {
  scope: BroadcastScope;
  subject: string;
  body: string;
  member_ids?: string[];
  subject_id?: string;
};

// --- Pagination helper -------------------------------------------------------

function listQuery(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  }
  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

// --- Overview / counts -------------------------------------------------------

export const getOverview = () => get<ManageOverview>("/api/manage/overview");
export const getCounts = () => get<ManageCounts>("/api/manage/counts");

// --- Members -----------------------------------------------------------------

export const listMembers = (params: { status?: AccountStatus; q?: string; limit?: number; offset?: number } = {}) =>
  get<ListEnvelope<ManageMember>>(`/api/manage/members${listQuery(params)}`);

export const getMember = (id: string) => get<ManageMemberDetail>(`/api/manage/members/${id}`);

export const admitMember = (id: string) =>
  post<{ id: string; status: "active" }>(`/api/manage/members/${id}/admit`);

export const rejectMember = (id: string, note?: string | null) =>
  post<{ id: string; status: "rejected" }>(`/api/manage/members/${id}/reject`, { note: note ?? null });

export const suspendMember = (id: string, input: SuspendInput = {}) =>
  post<{ id: string; status: "suspended"; cancelled_requests: number; released_claims: number }>(
    `/api/manage/members/${id}/suspend`,
    input,
  );

export const restoreMember = (id: string) =>
  post<{ id: string; status: "active" }>(`/api/manage/members/${id}/restore`);

// --- Managers ----------------------------------------------------------------

export const listManagers = (params: { status?: AccountStatus; limit?: number; offset?: number } = {}) =>
  get<ListEnvelope<ManageManager>>(`/api/manage/managers${listQuery(params)}`);

export const approveManager = (id: string) =>
  post<{ id: string; status: "active" }>(`/api/manage/managers/${id}/approve`);

export const rejectManager = (id: string, note?: string | null) =>
  post<{ id: string; status: "rejected" }>(`/api/manage/managers/${id}/reject`, { note: note ?? null });

// --- Subject approvals -------------------------------------------------------

export const listSubjectApprovals = (
  params: { status?: ApprovalStatus; subject_id?: string; member_id?: string; limit?: number; offset?: number } = {},
) => get<ListEnvelope<ManageApproval>>(`/api/manage/subject-approvals${listQuery(params)}`);

export const grantSubjectApproval = (input: DirectGrantInput) =>
  post<ManageApproval>("/api/manage/subject-approvals", input);

export const decideSubjectApproval = (id: string, input: DecideApprovalInput) =>
  post<ManageApproval>(`/api/manage/subject-approvals/${id}/decide`, input);

export const revokeSubjectApproval = (id: string, note?: string | null) =>
  post<ManageApproval>(`/api/manage/subject-approvals/${id}/revoke`, { note: note ?? null });

// --- Subjects ----------------------------------------------------------------

export const listSubjects = (params: { include?: "usage" } = {}) =>
  get<{ items: ManageSubject[] }>(`/api/manage/subjects${listQuery(params)}`).then((r) => r.items);

export const createSubject = (input: CreateSubjectInput) => post<ManageSubject>("/api/manage/subjects", input);

export const updateSubject = (id: string, input: PatchSubjectInput) =>
  patch<ManageSubject>(`/api/manage/subjects/${id}`, input);

// --- Sessions ----------------------------------------------------------------

export const listSessions = (
  params: { status?: SessionStatus | SessionStatus[]; subject_id?: string; member_id?: string; limit?: number; offset?: number } = {},
) => {
  const status = Array.isArray(params.status) ? params.status.join(",") : params.status;
  return get<ListEnvelope<ManageSession>>(
    `/api/manage/sessions${listQuery({ ...params, status })}`,
  );
};

export const getSession = (id: string) => get<ManageSessionDetail>(`/api/manage/sessions/${id}`);

export const cancelSession = (id: string, reason: string) =>
  post<ManageSession>(`/api/manage/sessions/${id}/cancel`, { reason });

export const reopenSession = (id: string, reason: string) =>
  post<ManageSession>(`/api/manage/sessions/${id}/reopen`, { reason });

export const requestSessionChanges = (id: string, reason: string) =>
  post<ManageSession>(`/api/manage/sessions/${id}/request-changes`, { reason });

export const verifySession = (id: string, input: VerifyInput) =>
  post<ManageSession>(`/api/manage/sessions/${id}/verify`, input);

export const setSessionPriority = (id: string, priority: PriorityLevel) =>
  patch<ManageSession>(`/api/manage/sessions/${id}`, { priority });

// --- Hours -------------------------------------------------------------------

export const listHoursTotals = (params: { q?: string; limit?: number; offset?: number } = {}) =>
  get<ListEnvelope<MemberHoursTotal>>(`/api/manage/hours/totals${listQuery(params)}`);

export const listHoursLedger = (params: { member_id?: string; limit?: number; offset?: number } = {}) =>
  get<ListEnvelope<LedgerEntry>>(`/api/manage/hours${listQuery(params)}`);

export const addHoursAdjustment = (input: AdjustmentInput) =>
  post<{ id: number; member_id: string; hours: number; note: string }>(
    "/api/manage/hours/adjustments",
    input,
  );

/**
 * Download a hours CSV (§5.10). Bearer-fetches the export route and triggers a
 * browser download from the returned blob.
 */
export async function exportHours(type: "totals" | "ledger"): Promise<void> {
  const { data } = await getBrowserClient().auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`/api/manage/hours/export?type=${type}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `scire-hours-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

// --- Emails ------------------------------------------------------------------

export const listEmailBatches = (params: { limit?: number; offset?: number } = {}) =>
  get<ListEnvelope<EmailBatchSummary>>(`/api/manage/emails${listQuery(params)}`);

export const getEmailBatch = (batchId: string) => get<EmailBatchDetail>(`/api/manage/emails/${batchId}`);

export const sendBroadcast = (input: BroadcastInput) =>
  post<{ batch_id: string; recipient_count: number; scope: BroadcastScope }>("/api/manage/emails", input);

// --- Help --------------------------------------------------------------------

export const listHelpRequests = (params: { status?: "open" | "resolved"; limit?: number; offset?: number } = {}) =>
  get<ListEnvelope<HelpRequest>>(`/api/manage/help-requests${listQuery(params)}`);

export const resolveHelpRequest = (id: string) =>
  post<{ id: string; status: "resolved" }>(`/api/manage/help-requests/${id}/resolve`);
