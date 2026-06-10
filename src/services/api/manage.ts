"use client";

/**
 * Canonical typed client for the `/api/manage/*` group (§7.9 / §5 / §7.2).
 *
 * This is the SINGLE source the whole manager UI consumes (overview, members,
 * approvals, managers, sessions, verification, hours, subjects, emails, help).
 * Every call is Bearer-authed through core's cookie-native session; failures
 * surface as `ApiError` (the manager shell maps `manager_not_active` → an
 * /api/auth/me refetch + the pending gate). `org_id` is ALWAYS server-derived
 * from the caller's manager profile — it is never a parameter here (§5.0).
 *
 * Shapes: party + subject references are nested objects ({id, first_name,
 * last_name[, email]} / the subject triple); `subjectLabel`/`memberName` /
 * `personName` compose the human strings. Lists use the shared
 * `{items,total,limit,offset}` envelope.
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

export type { ListEnvelope };

// --- Shared sub-shapes -------------------------------------------------------

/** A profile reference (the manager panel always shows real names). */
export type PersonRef = { id: string; first_name: string; last_name: string; email?: string } | null;
/** Alias kept for part-2 pages that imported the nested member ref by this name. */
export type ManageMemberRef = PersonRef;

/** The org-catalog subject triple embedded in manage rows. */
export type SubjectRef = { id: string; name: string; category: string | null; grade_level: number | null };
export type ManageSubjectRef = SubjectRef;
/** Inlined triple some member-detail rows carry directly (no nested object). */
export type SubjectTriple = { name: string; category: string | null; grade_level: number | null };

/** Compose the human subject label from the triple ("Math · IB · Grade 11"). */
export function subjectLabel(s: SubjectRef | SubjectTriple | null | undefined): string {
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
/** Alias kept for part-2 pages that imported the name helper as `memberName`. */
export const memberName = personName;

// --- Counts / overview (§5.3 / §5.4) -----------------------------------------

/** The five sidebar badge counts (`GET /api/manage/counts`). */
export type ManageCounts = {
  pending_admissions: number;
  approval_requests: number;
  verification_queue: number;
  pending_managers: number;
  open_help: number;
};

/** A "Needs attention" strip row (overview): the entity the inline action targets. */
export type ManageAttentionItem = { id: string; title: string; subtitle?: string | null };

/** A human-readable audit row (overview + member approval history). */
export type AuditEntry = {
  id: number;
  action: string;
  actor_name: string | null;
  actor_kind?: string | null;
  target_table?: string | null;
  target_id?: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};
/** A session-timeline entry (an audit row scoped to one session). */
export type SessionTimelineEntry = AuditEntry;

export type ManageOverviewStats = {
  active_members: number;
  pending_admissions: number;
  open_requests: number;
  scheduled: number;
  awaiting_verification: number;
  total_hours_awarded: number;
};

/** The overview aggregate (`GET /api/manage/overview`). */
export type ManageOverview = {
  stats: ManageOverviewStats;
  attention: {
    admissions: ManageAttentionItem[];
    approvals: ManageAttentionItem[];
    verification: ManageAttentionItem[];
    managers: ManageAttentionItem[];
    help: ManageAttentionItem[];
  };
  recent_audit: AuditEntry[];
};

export const getCounts = () => get<ManageCounts>("/api/manage/counts");
/** Alias kept for part-2 pages that imported counts as `getManageCounts`. */
export const getManageCounts = getCounts;
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
/** Alias for part-2 pages (pickers) that imported the directory row as `ManageMember`. */
export type ManageMember = ManageMemberRow;

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

/** A volunteer-hours ledger entry (award or adjustment), flat — member-detail tab. */
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

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** The members directory, filtered + paginated. */
export const listMembers = (params: ListMembersParams = {}) => {
  const { status, ...rest } = params;
  return get<ListEnvelope<ManageMemberRow>>(
    `/api/manage/members${buildQuery({ ...rest, status: status === "all" ? undefined : status })}`,
  );
};

/** One member's full detail. */
export const getMember = (id: string) => get<ManageMemberDetail>(`/api/manage/members/${id}`);

/** Admit a pending member → active (+ email). Optional welcome `note`. */
export const admitMember = (id: string, body: { note?: string } = {}) =>
  post<{ id: string; status: "active" }>(`/api/manage/members/${id}/admit`, body);

/** Reject a pending member → rejected (+ email). `note` → member-visible status_note. */
export const rejectMember = (id: string, body: { note?: string } = {}) =>
  post<{ id: string; status: "rejected" }>(`/api/manage/members/${id}/reject`, body);

/**
 * Suspend an active member → suspended (+ email). `cancel_active` cascade-cancels
 * their open requests + active sessions server-side; `note` → status_note.
 */
export const suspendMember = (id: string, body: { note?: string; cancel_active?: boolean }) =>
  post<{ id: string; status: "suspended"; cancelled_requests: number; released_claims: number }>(
    `/api/manage/members/${id}/suspend`,
    body,
  );

/** Restore a suspended/rejected member → active (+ email). Clears status_note. */
export const restoreMember = (id: string) =>
  post<{ id: string; status: "active" }>(`/api/manage/members/${id}/restore`);

/** A member's subject approvals (all states). */
export const getMemberApprovals = async (id: string): Promise<ManageMemberApproval[]> => {
  const { items } = await get<{ items: ManageMemberApproval[] }>(`/api/manage/members/${id}/approvals`);
  return items;
};

/** The audit-timeline approval history for a member (per-subject decisions). */
export const getMemberApprovalHistory = async (id: string): Promise<AuditEntry[]> => {
  const { items } = await get<{ items: AuditEntry[] }>(`/api/manage/members/${id}/approvals/history`);
  return items;
};

/** A member's sessions (as requester AND tutor). */
export const getMemberSessions = async (id: string): Promise<ManageMemberSession[]> => {
  const { items } = await get<{ items: ManageMemberSession[] }>(`/api/manage/members/${id}/sessions`);
  return items;
};

/** A member's volunteer-hours ledger (total + entries). */
export const getMemberHours = (id: string) =>
  get<MemberHoursResponse>(`/api/manage/members/${id}/hours`);

/** Add a signed, nonzero ledger adjustment for a member (reason required). */
export const adjustMemberHours = (id: string, body: { delta_hours: number; note: string }) =>
  post<ManageLedgerEntry>(`/api/manage/hours/adjustments`, {
    member_id: id,
    hours: body.delta_hours,
    note: body.note,
  });

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

/** A manager-facing approval row with nested member + subject (by-subject reuse). */
export type ManageApproval = {
  id: string;
  status: ApprovalStatus;
  member: PersonRef;
  subject: SubjectRef;
  evidence: string | null;
  decision_note: string | null;
  direct_grant: boolean;
  decided_at: string | null;
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

export type DecideApprovalInput = { decision: "approve" | "reject"; note?: string | null };

/**
 * Pending tutoring-approval requests, paginated (flat-triple variant). The
 * server returns the nested approval shape; flatten the subject triple inline so
 * the Requests tab's `subjectLabel(row)` reads it directly.
 */
export const listApprovalRequests = async (
  params: { limit?: number; offset?: number } = {},
): Promise<ListEnvelope<ManageApprovalRequest>> => {
  const res = await get<ListEnvelope<ManageApproval>>(`/api/manage/subject-approvals${buildQuery(params)}`);
  return {
    ...res,
    items: res.items.map((a) => ({
      id: a.id,
      member: a.member,
      name: a.subject?.name ?? "",
      category: a.subject?.category ?? null,
      grade_level: a.subject?.grade_level ?? null,
      evidence: a.evidence,
      created_at: a.created_at,
    })),
  };
};

/** Org subject-approval rows (any status), paginated — the nested-shape variant. */
export const listApprovals = (
  params: { status?: string; subject_id?: string; member_id?: string; limit?: number; offset?: number } = {},
) => get<ListEnvelope<ManageApproval>>(`/api/manage/subject-approvals${buildQuery(params)}`);

/**
 * Decide a pending request: approve | reject (+ optional note). Accepts either
 * `{decision, decision_note}` (part-1 caller) or `{decision, note}` and forwards
 * the server's `{action, note}` contract.
 */
export const decideApproval = (
  id: string,
  body: { decision: "approve" | "reject"; decision_note?: string | null; note?: string | null },
) =>
  post<ManageApproval>(`/api/manage/subject-approvals/${id}/decide`, {
    action: body.decision,
    note: body.decision_note ?? body.note ?? null,
  });

/** Directly grant a member approval for a subject (direct grant). */
export const grantSubject = (body: { member_id: string; subject_id: string }) =>
  post<ManageApproval>("/api/manage/subject-approvals", {
    member_id: body.member_id,
    org_subject_id: body.subject_id,
  });

/** Revoke an approved grant → revoked (+ audit). Tolerates a bare note or `{note}`. */
export const revokeApproval = (id: string, note?: string | { note?: string | null } | null) => {
  const resolved = typeof note === "object" && note != null ? note.note ?? null : note ?? null;
  return post<ManageApproval>(`/api/manage/subject-approvals/${id}/revoke`, { note: resolved });
};

/** Approved members for one subject (By-subject tab). */
export const listApprovedMembersForSubject = async (
  orgSubjectId: string,
): Promise<ManageSubjectApprovedMember[]> => {
  const { items } = await get<ListEnvelope<ManageApproval>>(
    `/api/manage/subject-approvals?subject_id=${orgSubjectId}&status=approved`,
  );
  return items.map((a) => ({
    approval_id: a.id,
    member_id: a.member?.id ?? "",
    first_name: a.member?.first_name ?? "",
    last_name: a.member?.last_name ?? "",
    email: a.member?.email ?? "",
    direct_grant: a.direct_grant,
    decided_at: a.decided_at,
  }));
};

// --- Subjects (§5.11) --------------------------------------------------------

/** An org-catalog subject (flat triple; usage counts present with `?include=usage`). */
export type ManageSubject = {
  id: string;
  org_id?: string;
  name: string;
  category: string | null;
  grade_level: number | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
  open_sessions?: number;
  approved_members?: number;
};
/** Alias for part-1 pickers that imported the catalog subject as `ManageOrgSubject`. */
export type ManageOrgSubject = ManageSubject;

export type SubjectInput = { name: string; category?: string | null; grade_level?: number | null };

/** Org subject catalog; pass `includeUsage` for open_sessions/approved_members counts. */
export const listSubjects = (params: { includeUsage?: boolean; q?: string } = {}) =>
  get<ListEnvelope<ManageSubject>>(
    `/api/manage/subjects${buildQuery({ include: params.includeUsage ? "usage" : undefined, q: params.q })}`,
  );

/** The org subject catalog as a bare array (part-1 grant / by-subject pickers). */
export const listOrgSubjects = async (params: { active?: boolean } = {}): Promise<ManageSubject[]> => {
  const { items } = await listSubjects({});
  return params.active == null ? items : items.filter((s) => s.active === params.active);
};

export const createSubject = (input: SubjectInput) => post<ManageSubject>("/api/manage/subjects", input);

export const updateSubject = (id: string, input: Partial<SubjectInput> & { active?: boolean }) =>
  patch<ManageSubject>(`/api/manage/subjects/${id}`, input);

/** Archive (active=false) — soft, never a hard delete (§5.11). */
export const archiveSubject = (id: string) =>
  patch<ManageSubject>(`/api/manage/subjects/${id}`, { active: false });

/** Reactivate an archived subject. */
export const reactivateSubject = (id: string) =>
  patch<ManageSubject>(`/api/manage/subjects/${id}`, { active: true });

// --- Sessions (§5.8) ---------------------------------------------------------

/** A session row as seen by a manager — nested requester + tutor + subject objects. */
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
  verified_by?: string | null;
  cancelled_at: string | null;
  cancelled_by?: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
};

/** The session detail payload: the full record plus its audit-derived timeline. */
export type ManageSessionDetail = { session: ManageSession; timeline: SessionTimelineEntry[] };

export type ManageSessionFilters = {
  status?: SessionStatus[];
  subjectId?: string;
  memberId?: string;
  q?: string;
  order?: "newest" | "oldest";
  limit?: number;
  offset?: number;
};

export type VerifyInput = { hours: number; note?: string | null };
export type RequestChangesInput = { reason: string };
export type CancelInput = { reason: string };
export type ReopenInput = { reason: string };
export type PriorityInput = { priority: PriorityLevel };

/** Sessions list with the §5.8 multi-status / subject / member / q / order filters. */
export const listSessions = (filters: ManageSessionFilters = {}) => {
  const sp = new URLSearchParams();
  for (const s of filters.status ?? []) sp.append("status", s);
  if (filters.subjectId) sp.set("subject_id", filters.subjectId);
  if (filters.memberId) sp.set("member_id", filters.memberId);
  if (filters.q) sp.set("q", filters.q);
  if (filters.order) sp.set("order", filters.order);
  if (filters.limit != null) sp.set("limit", String(filters.limit));
  if (filters.offset != null) sp.set("offset", String(filters.offset));
  const s = sp.toString();
  return get<ListEnvelope<ManageSession>>(`/api/manage/sessions${s ? `?${s}` : ""}`);
};

/** One session's full record + audit timeline (§5.8). */
export const getSessionDetail = (id: string) => get<ManageSessionDetail>(`/api/manage/sessions/${id}`);
export const getSession = getSessionDetail;

/** Cancel any non-terminal session → cancelled (reason required, both parties emailed). */
export const cancelSession = (id: string, input: CancelInput) =>
  post<ManageSession>(`/api/manage/sessions/${id}/cancel`, input);

/** Reopen claimed|availability_set|scheduled → open (clears claim, back to board). */
export const reopenSession = (id: string, input: ReopenInput) =>
  post<ManageSession>(`/api/manage/sessions/${id}/reopen`, input);

/** Request changes on a completed session → needs_changes (reason required). */
export const requestChanges = (id: string, input: RequestChangesInput) =>
  post<ManageSession>(`/api/manage/sessions/${id}/request-changes`, input);
export const requestSessionChanges = (id: string, reason: string) => requestChanges(id, { reason });

/** Verify completed|needs_changes → verified (one guarded UPDATE; trigger awards). */
export const verifySession = (id: string, input: VerifyInput) =>
  post<ManageSession>(`/api/manage/sessions/${id}/verify`, input);

/** Set triage priority (field edit; audited, NO party-facing email — §5.8). */
export const setPriority = (id: string, input: PriorityInput) =>
  patch<ManageSession>(`/api/manage/sessions/${id}`, input);
export const setSessionPriority = (id: string, priority: PriorityLevel) => setPriority(id, { priority });

/**
 * The verification queue: sessions in completed|needs_changes, OLDEST-first
 * (a first-in-first-out work list). Passes the two real statuses + `order=oldest`.
 */
export const listVerificationQueue = (params: { limit?: number; offset?: number } = {}) =>
  listSessions({ status: ["completed", "needs_changes"], order: "oldest", ...params });

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

/** Managers for my org (pending + active) as a bare array. */
export const listManagers = async (): Promise<ManageManagerRow[]> => {
  const { items } = await get<ListEnvelope<ManageManagerRow>>("/api/manage/managers");
  return items;
};

/** Decide a pending manager: approve → active (+email) | reject → rejected (+email). */
export const decideManager = (id: string, body: { decision: "approve" | "reject" }) =>
  patch<ManageManagerRow>(`/api/manage/managers/${id}`, body);

// --- Hours (§5.10) -----------------------------------------------------------

export type HoursTotal = { member: PersonRef; total_hours: number };

export type LedgerEntry = {
  id: number;
  kind: LedgerKind;
  hours: number;
  note: string | null;
  member: PersonRef;
  awarded_by_name: string | null;
  session_id: string | null;
  subject_name: string | null;
  created_at: string;
};

export type AdjustmentInput = { member_id: string; hours: number; note: string };

/** Per-member totals (sort desc), with optional `q`. */
export const listHoursTotals = (params: { q?: string; limit?: number; offset?: number } = {}) =>
  get<ListEnvelope<HoursTotal>>(`/api/manage/hours/totals${buildQuery(params)}`);

/** Org-wide append-only ledger (award|adjustment rows). */
export const listLedger = (params: { q?: string; member_id?: string; limit?: number; offset?: number } = {}) =>
  get<ListEnvelope<LedgerEntry>>(`/api/manage/hours${buildQuery(params)}`);
export const listHoursLedger = listLedger;

/** Manual signed adjustment (nonzero hours + required note). */
export const addAdjustment = (input: AdjustmentInput) =>
  post<LedgerEntry>("/api/manage/hours/adjustments", input);
export const addHoursAdjustment = addAdjustment;

/**
 * Download a hours CSV (totals|ledger) via an authed fetch (§5.10), returning the
 * Blob for the caller to save.
 */
export const exportHours = async (type: "totals" | "ledger"): Promise<Blob> => {
  const { data } = await getBrowserClient().auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`/api/manage/hours/export?type=${type}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  return res.blob();
};

// --- Emails (§5.12) ----------------------------------------------------------

export type EmailScope = "all_active" | "pending" | "approved_for_subject" | "member_ids";

export type ComposeEmailInput = {
  scope: EmailScope;
  member_ids?: string[];
  subject_id?: string;
  subject: string;
  body: string;
};

export type EmailBatch = {
  batch_id: string;
  subject: string;
  scope?: string;
  sender_name: string | null;
  recipient_count: number;
  created_at: string;
};

export type EmailRecipient = {
  id?: number;
  recipient_email: string;
  recipient_name: string | null;
  status: "sent" | "failed";
};

export type EmailBatchDetail = { batch: EmailBatch; body: string | null; recipients: EmailRecipient[] };

export type RecipientPreview = { count: number };

/** Map the UI's audience names onto the server's broadcast scope vocabulary. */
function serverScope(scope: EmailScope): "all_active" | "pending" | "subject" | "selected" {
  if (scope === "approved_for_subject") return "subject";
  if (scope === "member_ids") return "selected";
  return scope;
}

/** Live recipient-count preview for the compose audience (server resolves ∩ org). */
export const previewRecipients = (params: { scope: EmailScope; subject_id?: string; member_ids?: string[] }) => {
  const sp = new URLSearchParams();
  sp.set("scope", serverScope(params.scope));
  if (params.subject_id) sp.set("subject_id", params.subject_id);
  for (const id of params.member_ids ?? []) sp.append("member_id", id);
  return get<RecipientPreview>(`/api/manage/emails/preview?${sp.toString()}`);
};

export const listEmailBatches = (params: { limit?: number; offset?: number } = {}) =>
  get<ListEnvelope<EmailBatch>>(`/api/manage/emails${buildQuery(params)}`);

export const getEmailBatch = (batchId: string) => get<EmailBatchDetail>(`/api/manage/emails/${batchId}`);

/** Send a broadcast (server resolves recipients ∩ org; daily cap → 429). */
export const sendEmail = (input: ComposeEmailInput) =>
  post<{ batch_id: string; recipient_count: number; scope: string }>("/api/manage/emails", {
    scope: serverScope(input.scope),
    subject: input.subject,
    body: input.body,
    member_ids: input.member_ids,
    subject_id: input.subject_id,
  });

// --- Help (§5.13) ------------------------------------------------------------

export type HelpRequest = {
  id: string;
  urgency: UrgencyLevel;
  description: string;
  status: "open" | "resolved";
  member: PersonRef;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
};

export const listHelp = (params: { status?: "open" | "resolved"; limit?: number; offset?: number } = {}) =>
  get<ListEnvelope<HelpRequest>>(`/api/manage/help-requests${buildQuery(params)}`);
export const listHelpRequests = listHelp;

export const resolveHelp = (id: string) => post<HelpRequest>(`/api/manage/help-requests/${id}/resolve`, {});
export const resolveHelpRequest = resolveHelp;
