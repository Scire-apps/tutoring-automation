"use client";

/**
 * Typed client for the `/api/member/*` group (§7.9). Every call is Bearer-authed
 * via core's cookie-native session; errors surface as `ApiError` (the UI maps
 * `member_not_active` → refetch /api/auth/me + render the gate card). Caching is
 * opt-in: the dashboard/board get short TTLs, counts none.
 *
 * The DTO types below are the client mirror of the server response shapes
 * (§7.2 / §4); they are the cross-slice contract the member UI consumes. The
 * server returns sessions/approvals with NESTED subject + party objects; this
 * module flattens them into convenience fields (subject_name, requester_name, …)
 * so the UI renders the §4.3 role matrix without re-deriving them, and aliases
 * the viewer role `tutor → claimer` to match the UI's "Tutoring/Learning" chips.
 * Both nested and flat fields are present, so every consumer compiles against the
 * single source.
 */
import { get, post, patch, put } from "./core";
import type {
  AccountKind,
  AccountStatus,
  ApprovalStatus,
  LocationPreference,
  PriorityLevel,
  SessionStatus,
} from "@/types/api";

// --- Shared sub-shapes -------------------------------------------------------

export type PersonRef = { id: string; first_name: string; last_name: string } | null;

export type SubjectRef = {
  id: string;
  name: string;
  category: string | null;
  grade_level: number | null;
};

/** Viewer-relative role: requester = learner, claimer = tutor (the UI's chips). */
export type SessionRole = "requester" | "claimer";

/** The raw session shape the server returns (nested subject + party objects). */
type RawSession = {
  id: string;
  status: SessionStatus;
  priority: PriorityLevel;
  role: "requester" | "tutor";
  counterpart: PersonRef;
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
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A session as seen by a member: the server's nested fields PLUS flattened
 * convenience fields the UI reads directly (§4.3). `role` is `requester|claimer`
 * (server `tutor` is surfaced as `claimer`); `subject_label` is the composed
 * human subject string; `cancel_reason` aliases `cancelled_reason`.
 */
export type MemberSession = {
  id: string;
  status: SessionStatus;
  priority: PriorityLevel;
  role: SessionRole;
  /** Server's raw viewer role, kept for callers that want the literal value. */
  my_role: SessionRole;
  counterpart: PersonRef;
  requester: PersonRef;
  tutor: PersonRef;
  subject: SubjectRef;
  /** Composed "Name · Stream · Grade N" label. */
  subject_label: string;
  subject_name: string;
  subject_category: string | null;
  subject_grade: number | null;
  requester_name: string | null;
  tutor_name: string | null;
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
  cancelled_at: string | null;
  /** The canceller's profile id (a uuid, not a role — use `cancelled_by_role`). */
  cancelled_by: string | null;
  /**
   * Who cancelled, relative to the session: `requester` (the learner cancelled),
   * `tutor` (the claimer), or `manager` (a third party = a manager/admin acting on
   * the org). Derived from `cancelled_by` vs the party ids so the dashboard can
   * render the "Cancelled by your organization" provenance (§4.3). `null` when not
   * cancelled or the actor row was scrubbed.
   */
  cancelled_by_role: "requester" | "tutor" | "manager" | null;
  cancelled_reason: string | null;
  /** Alias of `cancelled_reason` (member-facing cancellation provenance). */
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
};

/** Compose the human subject label from the triple ("Math · IB · Grade 11"). */
function subjectLabel(s: SubjectRef): string {
  const bits: string[] = [s.name];
  if (s.category) bits.push(s.category);
  if (s.grade_level != null) bits.push(`Grade ${s.grade_level}`);
  return bits.join(" · ");
}

/** Person display name from a profile ref ("Ada L."→ "Ada Lovelace"). */
function personName(p: PersonRef): string | null {
  if (!p) return null;
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || null;
}

/** Classify the canceller relative to the session (learner / tutor / org). */
function cancelledByRole(raw: RawSession): MemberSession["cancelled_by_role"] {
  if (raw.status !== "cancelled" || !raw.cancelled_by) return null;
  if (raw.requester?.id === raw.cancelled_by) return "requester";
  if (raw.tutor?.id === raw.cancelled_by) return "tutor";
  // A third party cancelled it → a manager/admin acting on the org.
  return "manager";
}

/** Flatten a raw server session into the UI-facing `MemberSession` superset. */
function flattenSession(raw: RawSession): MemberSession {
  const role: SessionRole = raw.role === "tutor" ? "claimer" : "requester";
  return {
    ...raw,
    role,
    my_role: role,
    subject_label: subjectLabel(raw.subject),
    subject_name: raw.subject.name,
    subject_category: raw.subject.category,
    subject_grade: raw.subject.grade_level,
    requester_name: personName(raw.requester),
    tutor_name: personName(raw.tutor),
    cancelled_by_role: cancelledByRole(raw),
    cancel_reason: raw.cancelled_reason,
  };
}

/** A board row: an open session plus the caller's claim eligibility (flat). */
export type BoardItem = {
  id: string;
  org_subject_id: string;
  subject_name: string;
  subject_category: string | null;
  subject_grade: number | null;
  language: string | null;
  location_preference: LocationPreference;
  notes: string;
  created_at: string;
  can_claim: boolean;
  requester_name: string | null;
};

type RawBoardItem = RawSession & { can_claim: boolean };

function flattenBoardItem(raw: RawBoardItem): BoardItem {
  return {
    id: raw.id,
    org_subject_id: raw.subject.id,
    subject_name: raw.subject.name,
    subject_category: raw.subject.category,
    subject_grade: raw.subject.grade_level,
    language: raw.language,
    location_preference: raw.location_preference,
    notes: raw.notes,
    created_at: raw.created_at,
    can_claim: raw.can_claim,
    requester_name: personName(raw.requester),
  };
}

/** An approval row: nested subject PLUS flattened convenience fields (§4.8). */
export type MemberApproval = {
  id: string;
  status: ApprovalStatus;
  subject: SubjectRef;
  org_subject_id: string;
  subject_name: string;
  subject_category: string | null;
  subject_grade: number | null;
  evidence: string | null;
  decision_note: string | null;
  direct_grant: boolean;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

type RawApproval = {
  id: string;
  status: ApprovalStatus;
  subject: SubjectRef;
  evidence: string | null;
  decision_note: string | null;
  direct_grant: boolean;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

function flattenApproval(raw: RawApproval): MemberApproval {
  return {
    ...raw,
    org_subject_id: raw.subject.id,
    subject_name: raw.subject.name,
    subject_category: raw.subject.category,
    subject_grade: raw.subject.grade_level,
  };
}

/** A catalog subject merged with the caller's approval status (flat, §4.5/§4.8). */
export type MemberSubject = {
  org_subject_id: string;
  name: string;
  subject_name: string;
  category: string | null;
  grade_level: number | null;
  active: boolean;
  approval_status: ApprovalStatus | null;
  /** True unless already pending/approved (drives the request combobox). */
  can_request_approval: boolean;
};

type RawSubject = {
  id: string;
  name: string;
  category: string | null;
  grade_level: number | null;
  my_approval_status: ApprovalStatus | null;
  can_request_approval: boolean;
};

function flattenSubject(raw: RawSubject): MemberSubject {
  return {
    org_subject_id: raw.id,
    name: raw.name,
    subject_name: raw.name,
    category: raw.category,
    grade_level: raw.grade_level,
    active: true,
    approval_status: raw.my_approval_status,
    can_request_approval: raw.can_request_approval,
  };
}

export type MemberDashboard = {
  org: { id: string };
  stats: {
    volunteer_hours: number;
    sessions_tutored: number;
    sessions_received: number;
    approved_subjects: number;
  };
  open_requests: MemberSession[];
  sessions: MemberSession[];
  /** Last 10 verified / terminally-cancelled rows. Aliased as `past`. */
  past_sessions: MemberSession[];
  past: MemberSession[];
};

type RawDashboard = {
  org: { id: string };
  stats: MemberDashboard["stats"];
  open_requests: RawSession[];
  sessions: RawSession[];
  past: RawSession[];
};

export type MemberCounts = { action_count: number };

export type HoursItem = {
  id: number;
  kind: "award" | "adjustment";
  hours: number;
  note: string | null;
  session_id: string | null;
  subject_name: string | null;
  created_at: string;
};

export type MemberHours = {
  total_hours: number;
  items: HoursItem[];
  total: number;
  limit: number;
  offset: number;
};

export type HelpRequestRow = {
  id: string;
  urgency: "low" | "normal" | "high";
  description: string;
  status: "open" | "resolved";
  created_at: string;
};

/** The member-editable profile slice (returned by PATCH profile, matches MeProfile). */
export type MemberProfile = {
  id: string;
  kind: AccountKind;
  status: AccountStatus;
  org: { id: string; name: string } | null;
  first_name: string;
  last_name: string;
  grade: number | null;
  pronouns: string | null;
  status_note: string | null;
  created_at: string;
};

export type ListEnvelope<T> = { items: T[]; total: number; limit: number; offset: number };

// --- Request bodies ----------------------------------------------------------

export type CreateSessionInput = {
  org_subject_id: string;
  location_preference: LocationPreference;
  notes: string;
  language?: string | null;
};

export type AvailabilityInput = {
  availability: Record<string, string[]>;
  duration_minutes: number;
};

export type ScheduleInput = {
  scheduled_at: string;
  date: string;
  start: string;
  duration_minutes: number;
  location?: string | null;
};

export type SubjectApprovalInput = { org_subject_id: string; evidence: string };
export type HelpInput = { urgency?: "low" | "normal" | "high"; description: string };
export type ProfileInput = {
  first_name?: string;
  last_name?: string;
  grade?: number | null;
  pronouns?: string | null;
};

// --- Calls -------------------------------------------------------------------

/** Dashboard aggregate (stats + open requests + active sessions + past). */
export const getDashboard = async (): Promise<MemberDashboard> => {
  const raw = await get<RawDashboard>("/api/member/dashboard", { ttl: 30_000 });
  const past = raw.past.map(flattenSession);
  return {
    org: raw.org,
    stats: raw.stats,
    open_requests: raw.open_requests.map(flattenSession),
    sessions: raw.sessions.map(flattenSession),
    past_sessions: past,
    past,
  };
};

/** Action badge count — never cached (polled). */
export const getCounts = () => get<MemberCounts>("/api/member/counts");

/** Org subject catalog merged with my approval status (flat rows). */
export const getSubjects = async (): Promise<MemberSubject[]> => {
  const { items } = await get<{ items: RawSubject[] }>("/api/member/subjects", { ttl: 60_000 });
  return items.map(flattenSubject);
};
/** Alias (devC naming). */
export const listSubjects = getSubjects;

/** My subject approvals (all five states, flat). */
export const getApprovals = async (): Promise<MemberApproval[]> => {
  const { items } = await get<{ items: RawApproval[] }>("/api/member/subject-approvals");
  return items.map(flattenApproval);
};
/** Alias (devC naming). */
export const listSubjectApprovals = getApprovals;

/** Request (or re-request) approval to tutor a subject. */
export const requestApproval = async (input: SubjectApprovalInput): Promise<MemberApproval> =>
  flattenApproval(await post<RawApproval>("/api/member/subject-approvals", input));
/** Alias (devC naming). */
export const requestSubjectApproval = requestApproval;

/** Withdraw a pending approval request. */
export const withdrawApproval = async (id: string): Promise<MemberApproval> =>
  flattenApproval(await post<RawApproval>(`/api/member/subject-approvals/${id}/withdraw`));

/** The org tutoring board (open requests excluding mine), paginated + flat. */
export const listBoard = async (
  params: { subjectId?: string; limit?: number; offset?: number; eligibleOnly?: boolean } = {},
): Promise<ListEnvelope<BoardItem>> => {
  const q = new URLSearchParams();
  if (params.subjectId) q.set("subject_id", params.subjectId);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  if (params.eligibleOnly) q.set("eligible_only", "1");
  const qs = q.toString();
  const env = await get<ListEnvelope<RawBoardItem>>(
    `/api/member/board${qs ? `?${qs}` : ""}`,
    { ttl: 15_000 },
  );
  return { ...env, items: env.items.map(flattenBoardItem) };
};
/** Alias accepting the snake_case param name. */
export const getBoard = (params: { subject_id?: string; limit?: number; offset?: number } = {}) =>
  listBoard({ subjectId: params.subject_id, limit: params.limit, offset: params.offset });

/** Create a tutoring request. */
export const createSession = async (input: CreateSessionInput): Promise<MemberSession> =>
  flattenSession(await post<RawSession>("/api/member/sessions", input));
/** Alias (devC naming). */
export const createRequest = createSession;

/** My sessions, optionally filtered by role + status (concrete enum or open|active|past). */
export const getSessions = async (
  params: { role?: SessionRole; status?: string } = {},
): Promise<{ items: MemberSession[] }> => {
  const q = new URLSearchParams();
  // The server's role param is requester|tutor; map the UI's claimer → tutor.
  if (params.role) q.set("role", params.role === "claimer" ? "tutor" : "requester");
  if (params.status) q.set("status", params.status);
  const qs = q.toString();
  const { items } = await get<{ items: RawSession[] }>(`/api/member/sessions${qs ? `?${qs}` : ""}`);
  return { items: items.map(flattenSession) };
};

/** One session by id. */
export const getSession = async (id: string): Promise<MemberSession> =>
  flattenSession(await get<RawSession>(`/api/member/sessions/${id}`));

/** Claim an open request (atomic). */
export const claimSession = async (id: string): Promise<MemberSession> =>
  flattenSession(await post<RawSession>(`/api/member/sessions/${id}/claim`));

/** Requester sets/edits availability + duration. */
export const setAvailability = async (id: string, input: AvailabilityInput): Promise<MemberSession> =>
  flattenSession(await post<RawSession>(`/api/member/sessions/${id}/availability`, input));

/** Claimer schedules the exact slot. */
export const scheduleSession = async (id: string, input: ScheduleInput): Promise<MemberSession> =>
  flattenSession(await post<RawSession>(`/api/member/sessions/${id}/schedule`, input));

/** Save/edit the recording link (scheduled|needs_changes only). */
export const saveRecording = async (
  id: string,
  input: { recording_url: string },
): Promise<MemberSession> =>
  flattenSession(await put<RawSession>(`/api/member/sessions/${id}/recording`, input));

/** Mark the session complete (requires a saved recording link). */
export const completeSession = async (id: string): Promise<MemberSession> =>
  flattenSession(await post<RawSession>(`/api/member/sessions/${id}/complete`));

/** Cancel: requester → terminal cancel; claimer → release back to the board. */
export const cancelSession = async (id: string, reason?: string): Promise<MemberSession> =>
  flattenSession(await post<RawSession>(`/api/member/sessions/${id}/cancel`, { reason: reason ?? null }));

/** My volunteer-hours ledger (total + paginated items). */
export const getHours = (params: { limit?: number; offset?: number } = {}) => {
  const q = new URLSearchParams();
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  const qs = q.toString();
  return get<MemberHours>(`/api/member/hours${qs ? `?${qs}` : ""}`);
};

/** Ask the org's managers for help (active members only). */
export const submitHelp = (input: HelpInput) => post<HelpRequestRow>("/api/member/help", input);

/** Edit my profile (allowed at any status). */
export const updateProfile = (input: ProfileInput) =>
  patch<MemberProfile>("/api/member/profile", input);
