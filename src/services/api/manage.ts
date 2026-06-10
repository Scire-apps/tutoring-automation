"use client";

/**
 * Typed client for the `/api/manage/*` group (§7.9 / §5 / §7.2). Bearer-authed via
 * core's cookie-native session; errors surface as `ApiError` so callers branch on
 * `code` (e.g. a verify race → 409 `invalid_state`). Every list is the standard
 * `{items,total,limit,offset}` envelope; `org_id` is ALWAYS server-derived from the
 * caller's manager profile — never a client input.
 *
 * The DTO types here are the cross-slice contract the manager UI consumes. The
 * server returns sessions/approvals/hours with NESTED member + subject objects;
 * the calls below pass them through as typed shapes (the manager UI renders the
 * nested objects directly — no flattening is required at this surface).
 *
 * NOTE (seam): this module is the single canonical manage client. It is consumed
 * by every `/manager/**` page across the S4 manager slice (overview, members,
 * approvals, managers — and the part-2 sessions/verification/hours/subjects/emails/
 * help screens in this commit). If a sibling S4 developer also authored a manage.ts
 * the reviewer reconciles to this superset, mirroring how member.ts became the
 * single source in S3.
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
} from "@/types/api";

// --- Shared sub-shapes -------------------------------------------------------

export type ListEnvelope<T> = { items: T[]; total: number; limit: number; offset: number };

/** A member reference embedded in manage rows (sessions, approvals, hours, help). */
export type ManageMemberRef = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
} | null;

/** A subject reference (the org-catalog triple) embedded in manage rows. */
export type ManageSubjectRef = {
  id: string;
  name: string;
  category: string | null;
  grade_level: number | null;
};

/** Compose the human subject label from the triple ("Math · IB · Grade 11"). */
export function subjectLabel(s: ManageSubjectRef | null | undefined): string {
  if (!s) return "—";
  const bits: string[] = [s.name];
  if (s.category) bits.push(s.category);
  if (s.grade_level != null) bits.push(`Grade ${s.grade_level}`);
  return bits.join(" · ");
}

/** Person display name from a profile ref ("Ada Lovelace"). */
export function memberName(p: ManageMemberRef): string {
  if (!p) return "—";
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—";
}

// --- Counts / overview -------------------------------------------------------

/** Sidebar numeric badges (§5.3) — never cached (polled on nav + focus). */
export type ManageCounts = {
  pending_admissions: number;
  approval_requests: number;
  verification_queue: number;
  pending_managers: number;
  open_help: number;
};

export type ManageOverviewStats = {
  active_members: number;
  pending_admissions: number;
  open_requests: number;
  scheduled: number;
  awaiting_verification: number;
  total_hours_awarded: number;
};

export type AuditEntry = {
  id: number;
  action: string;
  actor_name: string | null;
  target_table: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ManageOverview = {
  stats: ManageOverviewStats;
  recent_audit: AuditEntry[];
};

// --- Members -----------------------------------------------------------------

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
};

// --- Sessions (§5.8) ---------------------------------------------------------

/**
 * A session row as seen by a manager. The server embeds requester + tutor + subject
 * objects; the manager UI renders them directly. `priority` drives the triage badge
 * and the priority-DESC ordering.
 */
export type ManageSession = {
  id: string;
  status: SessionStatus;
  priority: PriorityLevel;
  requester: ManageMemberRef;
  tutor: ManageMemberRef;
  subject: ManageSubjectRef;
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

/** A single audit-log entry on a session's timeline (§5.8). */
export type SessionTimelineEntry = {
  id: number;
  action: string;
  actor_name: string | null;
  actor_kind: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

/** The session detail payload: the full record plus its audit-derived timeline. */
export type ManageSessionDetail = {
  session: ManageSession;
  timeline: SessionTimelineEntry[];
};

export type ManageSessionFilters = {
  status?: SessionStatus[];
  subjectId?: string;
  memberId?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

// --- Verification (§5.9) -----------------------------------------------------

export type VerifyInput = { hours: number; note?: string | null };
export type RequestChangesInput = { reason: string };
export type CancelInput = { reason: string };
export type ReopenInput = { reason: string };
export type PriorityInput = { priority: PriorityLevel };

// --- Subject approvals (§5.6) ------------------------------------------------

export type ManageApproval = {
  id: string;
  status: ApprovalStatus;
  member: ManageMemberRef;
  subject: ManageSubjectRef;
  evidence: string | null;
  decision_note: string | null;
  direct_grant: boolean;
  decided_at: string | null;
  created_at: string;
};

export type DecideApprovalInput = { decision: "approve" | "reject"; note?: string | null };

// --- Subjects (§5.11) --------------------------------------------------------

/** An org-catalog subject with usage counts (when `?include=usage`). */
export type ManageSubject = {
  id: string;
  name: string;
  category: string | null;
  grade_level: number | null;
  active: boolean;
  open_sessions: number;
  approved_members: number;
  created_at: string;
};

export type SubjectInput = {
  name: string;
  category?: string | null;
  grade_level?: number | null;
};

// --- Hours (§5.10) -----------------------------------------------------------

export type HoursTotal = {
  member: ManageMemberRef;
  total_hours: number;
};

export type LedgerEntry = {
  id: number;
  kind: LedgerKind;
  hours: number;
  note: string | null;
  member: ManageMemberRef;
  awarded_by_name: string | null;
  session_id: string | null;
  subject_name: string | null;
  created_at: string;
};

export type AdjustmentInput = {
  member_id: string;
  hours: number;
  note: string;
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
  scope: string;
  sender_name: string | null;
  recipient_count: number;
  created_at: string;
};

export type EmailRecipient = {
  id: number;
  recipient_email: string;
  recipient_name: string | null;
  status: "sent" | "failed";
};

export type EmailBatchDetail = {
  batch: EmailBatch;
  body: string | null;
  recipients: EmailRecipient[];
};

export type RecipientPreview = { count: number };

// --- Help (§5.13) ------------------------------------------------------------

export type HelpRequest = {
  id: string;
  urgency: UrgencyLevel;
  description: string;
  status: "open" | "resolved";
  member: ManageMemberRef;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
};

// --- Query-string helper -----------------------------------------------------

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// --- Calls: counts / overview ------------------------------------------------

export const getManageCounts = () => get<ManageCounts>("/api/manage/counts");
export const getOverview = () => get<ManageOverview>("/api/manage/overview");

// --- Calls: members ----------------------------------------------------------

export const listMembers = (params: { status?: string; q?: string; limit?: number; offset?: number } = {}) =>
  get<ListEnvelope<ManageMember>>(`/api/manage/members${qs(params)}`);

// --- Calls: sessions (§5.8) --------------------------------------------------

/** Sessions list with the §5.8 multi-status / subject / member / q filters. */
export const listSessions = (filters: ManageSessionFilters = {}) => {
  const sp = new URLSearchParams();
  for (const s of filters.status ?? []) sp.append("status", s);
  if (filters.subjectId) sp.set("subject_id", filters.subjectId);
  if (filters.memberId) sp.set("member_id", filters.memberId);
  if (filters.q) sp.set("q", filters.q);
  if (filters.limit != null) sp.set("limit", String(filters.limit));
  if (filters.offset != null) sp.set("offset", String(filters.offset));
  const s = sp.toString();
  return get<ListEnvelope<ManageSession>>(`/api/manage/sessions${s ? `?${s}` : ""}`);
};

/** One session's full record + audit timeline (§5.8). */
export const getSessionDetail = (id: string) =>
  get<ManageSessionDetail>(`/api/manage/sessions/${id}`);

/** Cancel any non-terminal session → cancelled (reason required, both parties emailed). */
export const cancelSession = (id: string, input: CancelInput) =>
  post<ManageSession>(`/api/manage/sessions/${id}/cancel`, input);

/** Reopen claimed|availability_set|scheduled → open (clears claim, back to board). */
export const reopenSession = (id: string, input: ReopenInput) =>
  post<ManageSession>(`/api/manage/sessions/${id}/reopen`, input);

/** Request changes on a completed session → needs_changes (reason required). */
export const requestChanges = (id: string, input: RequestChangesInput) =>
  post<ManageSession>(`/api/manage/sessions/${id}/request-changes`, input);

/** Verify completed|needs_changes → verified (one guarded UPDATE; trigger awards). */
export const verifySession = (id: string, input: VerifyInput) =>
  post<ManageSession>(`/api/manage/sessions/${id}/verify`, input);

/** Set triage priority (field edit; audited, NO party-facing email — §5.8). */
export const setPriority = (id: string, input: PriorityInput) =>
  patch<ManageSession>(`/api/manage/sessions/${id}`, input);

// --- Calls: verification (§5.9) ----------------------------------------------

/**
 * The verification queue: sessions in completed|needs_changes, OLDEST-first
 * (overriding the list default of priority/created_at DESC — the queue is a
 * first-in-first-out work list). Passes the two real statuses plus `order=oldest`
 * so the server doesn't need a magic sentinel.
 */
export const listVerificationQueue = (params: { limit?: number; offset?: number } = {}) => {
  const sp = new URLSearchParams();
  sp.append("status", "completed");
  sp.append("status", "needs_changes");
  sp.set("order", "oldest");
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  return get<ListEnvelope<ManageSession>>(`/api/manage/sessions?${sp.toString()}`);
};

// --- Calls: subject approvals (§5.6) -----------------------------------------

export const listApprovals = (params: { status?: string; q?: string; limit?: number; offset?: number } = {}) =>
  get<ListEnvelope<ManageApproval>>(`/api/manage/subject-approvals${qs(params)}`);

export const decideApproval = (id: string, input: DecideApprovalInput) =>
  post<ManageApproval>(`/api/manage/subject-approvals/${id}/decide`, input);

export const revokeApproval = (id: string, note?: string) =>
  post<ManageApproval>(`/api/manage/subject-approvals/${id}/revoke`, { note: note ?? null });

// --- Calls: subjects (§5.11) -------------------------------------------------

/** Org subject catalog; pass `includeUsage` for open_sessions/approved_members counts. */
export const listSubjects = (params: { includeUsage?: boolean; q?: string } = {}) =>
  get<ListEnvelope<ManageSubject>>(
    `/api/manage/subjects${qs({ include: params.includeUsage ? "usage" : undefined, q: params.q })}`,
  );

export const createSubject = (input: SubjectInput) =>
  post<ManageSubject>("/api/manage/subjects", input);

export const updateSubject = (id: string, input: Partial<SubjectInput> & { active?: boolean }) =>
  patch<ManageSubject>(`/api/manage/subjects/${id}`, input);

/** Archive (active=false) — soft, never a hard delete (§5.11). */
export const archiveSubject = (id: string) =>
  patch<ManageSubject>(`/api/manage/subjects/${id}`, { active: false });

/** Reactivate an archived subject. */
export const reactivateSubject = (id: string) =>
  patch<ManageSubject>(`/api/manage/subjects/${id}`, { active: true });

// --- Calls: hours (§5.10) ----------------------------------------------------

/** Per-member totals (sort desc), with optional `q`. */
export const listHoursTotals = (params: { q?: string; limit?: number; offset?: number } = {}) =>
  get<ListEnvelope<HoursTotal>>(`/api/manage/hours/totals${qs(params)}`);

/** Org-wide append-only ledger (award|adjustment rows). */
export const listLedger = (params: { q?: string; limit?: number; offset?: number } = {}) =>
  get<ListEnvelope<LedgerEntry>>(`/api/manage/hours${qs(params)}`);

/** Manual signed adjustment (nonzero hours + required note). */
export const addAdjustment = (input: AdjustmentInput) =>
  post<LedgerEntry>("/api/manage/hours/adjustments", input);

/**
 * Download a hours CSV (totals|ledger) as a Blob via an authed fetch (§5.10).
 * Bearer-set from the cookie session; returns the blob for the caller to save.
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

// --- Calls: emails (§5.12) ---------------------------------------------------

/** Live recipient-count preview for the compose audience (server resolves ∩ org). */
export const previewRecipients = (params: { scope: EmailScope; subject_id?: string; member_ids?: string[] }) => {
  const sp = new URLSearchParams();
  sp.set("scope", params.scope);
  if (params.subject_id) sp.set("subject_id", params.subject_id);
  for (const id of params.member_ids ?? []) sp.append("member_id", id);
  return get<RecipientPreview>(`/api/manage/emails/preview?${sp.toString()}`);
};

export const listEmailBatches = (params: { limit?: number; offset?: number } = {}) =>
  get<ListEnvelope<EmailBatch>>(`/api/manage/emails${qs(params)}`);

export const getEmailBatch = (batchId: string) =>
  get<EmailBatchDetail>(`/api/manage/emails/${batchId}`);

/** Send a broadcast (server resolves recipients ∩ org; daily cap → 429). */
export const sendEmail = (input: ComposeEmailInput) =>
  post<{ batch_id: string; recipient_count: number }>("/api/manage/emails", input);

// --- Calls: help (§5.13) -----------------------------------------------------

export const listHelp = (params: { status?: "open" | "resolved"; limit?: number; offset?: number } = {}) =>
  get<ListEnvelope<HelpRequest>>(`/api/manage/help-requests${qs(params)}`);

export const resolveHelp = (id: string) =>
  post<HelpRequest>(`/api/manage/help-requests/${id}/resolve`, {});
