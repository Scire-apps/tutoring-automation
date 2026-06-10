/**
 * Server-side shaping of `sessions` rows into the member-facing DTO (§7.2 / §4.3).
 *
 * A member sees sessions from BOTH directions (as requester = "learning", as
 * tutor/claimer = "tutoring"). The dashboard and the session lists annotate each
 * row with its `role` relative to the caller plus the counterpart's display name
 * and the subject name, so the client renders the role chip + actions without a
 * second round-trip. Joins ride composite FKs on the RLS-bound client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];

export type SessionRole = "requester" | "tutor";

/** A profile reference embedded in a session DTO (NULL counterpart → null). */
export type PersonRef = { id: string; first_name: string; last_name: string } | null;

/**
 * The session shape returned to members. Carries the caller's `role`, the
 * counterpart (the other party from the caller's perspective), the subject name,
 * and the full lifecycle columns the dashboard needs to drive its actions.
 */
export type MemberSessionDTO = {
  id: string;
  status: Database["public"]["Enums"]["session_status"];
  priority: Database["public"]["Enums"]["priority_level"];
  role: SessionRole;
  counterpart: PersonRef;
  requester: PersonRef;
  tutor: PersonRef;
  subject: { id: string; name: string; category: string | null; grade_level: number | null };
  language: string | null;
  location_preference: Database["public"]["Enums"]["location_preference"];
  notes: string;
  availability: Database["public"]["Tables"]["sessions"]["Row"]["availability"];
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
 * The PostgREST select that hydrates a session with its subject + both party
 * profiles via the composite FKs. Shared by every read path so the DTO builder
 * always receives the same embedded shape.
 */
export const SESSION_SELECT = `
  *,
  subject:org_subjects!sessions_subject_fk ( id, name, category, grade_level ),
  requester:profiles!sessions_requester_fk ( id, first_name, last_name ),
  tutor:profiles!sessions_tutor_fk ( id, first_name, last_name )
` as const;

/** The row shape returned by a `SESSION_SELECT` query (embeds added to the base row). */
type SessionWithJoins = SessionRow & {
  subject: { id: string; name: string; category: string | null; grade_level: number | null } | null;
  requester: { id: string; first_name: string; last_name: string } | null;
  tutor: { id: string; first_name: string; last_name: string } | null;
};

/** Build the member DTO for a joined session row, relative to `viewerId`. */
export function toMemberSessionDTO(row: SessionWithJoins, viewerId: string): MemberSessionDTO {
  const role: SessionRole = row.tutor_id === viewerId ? "tutor" : "requester";
  const counterpart: PersonRef = role === "tutor" ? row.requester : row.tutor;
  return {
    id: row.id,
    status: row.status,
    priority: row.priority,
    role,
    counterpart,
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
    cancelled_at: row.cancelled_at,
    cancelled_by: row.cancelled_by,
    cancelled_reason: row.cancelled_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Read a single session by id with the standard joins, RLS-bound. Returns null
 * when the row is invisible/absent (the route maps that to 404 — cross-org probes
 * are indistinguishable from missing rows, §7.1).
 */
export async function readSession(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<SessionWithJoins | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select(SESSION_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as SessionWithJoins;
}

export type { SessionWithJoins };
