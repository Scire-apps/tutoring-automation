"use client";

/**
 * Typed client for the `/api/member/*` group (§7.9). Every call is Bearer-authed
 * via core's cookie-native session; errors surface as `ApiError` (the UI maps
 * `member_not_active` → refetch /api/auth/me + render the gate card). Caching is
 * opt-in: the dashboard/board get short TTLs, counts none.
 *
 * The DTO types below are the client mirror of the server response shapes
 * (§7.2 / §4); they are the cross-slice contract the member UI consumes.
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

export type SessionRole = "requester" | "tutor";

/** A session as seen by a member, annotated with their role + the counterpart. */
export type MemberSession = {
  id: string;
  status: SessionStatus;
  priority: PriorityLevel;
  role: SessionRole;
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

/** A board row: an open session plus the caller's claim eligibility. */
export type BoardSession = MemberSession & { can_claim: boolean };

export type MemberApproval = {
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

/** A catalog subject merged with the caller's approval status. */
export type MemberSubject = SubjectRef & {
  my_approval_status: ApprovalStatus | null;
  can_request_approval: boolean;
};

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
  past: MemberSession[];
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
export const getDashboard = () => get<MemberDashboard>("/api/member/dashboard", { ttl: 30_000 });

/** Action badge count — never cached (polled). */
export const getCounts = () => get<MemberCounts>("/api/member/counts");

/** Org subject catalog merged with my approval status. */
export const getSubjects = () => get<{ items: MemberSubject[] }>("/api/member/subjects", { ttl: 60_000 });

/** My subject approvals (all five states). */
export const getApprovals = () => get<{ items: MemberApproval[] }>("/api/member/subject-approvals");

/** Request (or re-request) approval to tutor a subject. */
export const requestApproval = (input: SubjectApprovalInput) =>
  post<MemberApproval>("/api/member/subject-approvals", input);

/** Withdraw a pending approval request. */
export const withdrawApproval = (id: string) =>
  post<MemberApproval>(`/api/member/subject-approvals/${id}/withdraw`);

/** The org tutoring board (open requests excluding mine), paginated. */
export const getBoard = (params: { subject_id?: string; limit?: number; offset?: number } = {}) => {
  const q = new URLSearchParams();
  if (params.subject_id) q.set("subject_id", params.subject_id);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  const qs = q.toString();
  return get<ListEnvelope<BoardSession>>(`/api/member/board${qs ? `?${qs}` : ""}`, { ttl: 15_000 });
};

/** Create a tutoring request. */
export const createSession = (input: CreateSessionInput) =>
  post<MemberSession>("/api/member/sessions", input);

/** My sessions, optionally filtered by role + status (concrete enum or open|active|past). */
export const getSessions = (params: { role?: SessionRole; status?: string } = {}) => {
  const q = new URLSearchParams();
  if (params.role) q.set("role", params.role);
  if (params.status) q.set("status", params.status);
  const qs = q.toString();
  return get<{ items: MemberSession[] }>(`/api/member/sessions${qs ? `?${qs}` : ""}`);
};

/** One session by id. */
export const getSession = (id: string) => get<MemberSession>(`/api/member/sessions/${id}`);

/** Claim an open request (atomic). */
export const claimSession = (id: string) => post<MemberSession>(`/api/member/sessions/${id}/claim`);

/** Requester sets/edits availability + duration. */
export const setAvailability = (id: string, input: AvailabilityInput) =>
  post<MemberSession>(`/api/member/sessions/${id}/availability`, input);

/** Claimer schedules the exact slot. */
export const scheduleSession = (id: string, input: ScheduleInput) =>
  post<MemberSession>(`/api/member/sessions/${id}/schedule`, input);

/** Save/edit the recording link (scheduled|needs_changes only). */
export const saveRecording = (id: string, recording_url: string) =>
  put<MemberSession>(`/api/member/sessions/${id}/recording`, { recording_url });

/** Mark the session complete (requires a saved recording link). */
export const completeSession = (id: string) => post<MemberSession>(`/api/member/sessions/${id}/complete`);

/** Cancel: requester → terminal cancel; claimer → release back to the board. */
export const cancelSession = (id: string, reason?: string) =>
  post<MemberSession>(`/api/member/sessions/${id}/cancel`, { reason: reason ?? null });

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
