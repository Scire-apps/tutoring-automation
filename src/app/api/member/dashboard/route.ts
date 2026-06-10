import { requireActiveMember } from "@/lib/auth";
import { json, serverError } from "@/lib/http";
import { SESSION_SELECT, toMemberSessionDTO, type MemberSessionDTO, type SessionWithJoins } from "@/lib/member/session-dto";
import type { Database } from "@/types/database";

type SessionStatus = Database["public"]["Enums"]["session_status"];

export const dynamic = "force-dynamic";

/**
 * GET /api/member/dashboard — the single aggregate powering the member dashboard
 * (§4.3). One pass returns:
 *   - stats: volunteer hours (SUM of the ledger — no cached counter), sessions
 *     tutored (verified as claimer), sessions received (verified as requester),
 *     approved-subjects count;
 *   - open_requests: the caller's own `open` sessions (the "My Requests" strip);
 *   - sessions: active sessions in BOTH directions, role-annotated;
 *   - past: last 10 verified or terminally-cancelled rows.
 *
 * All reads are RLS-bound, so a member only ever sees their own + their org's
 * rows. Hours come from `volunteer_hours_ledger` (member SELECT own).
 */
export async function GET(req: Request) {
  const auth = await requireActiveMember(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth;
  const uid = user.id;

  // Volunteer hours = SUM over the member's ledger (award + adjustment rows).
  const ledgerP = supabase
    .from("volunteer_hours_ledger")
    .select("hours")
    .eq("profile_id", uid);

  // Approved-subjects count.
  const approvalsP = supabase
    .from("subject_approvals")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", uid)
    .eq("status", "approved");

  // Verified sessions split by direction (for the two "Sessions" stat cards).
  const tutoredP = supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("tutor_id", uid)
    .eq("status", "verified");
  const receivedP = supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("requester_id", uid)
    .eq("status", "verified");

  // Active sessions in both directions (requester OR tutor), excluding open and
  // terminal rows — those live in open_requests / past respectively.
  const activeStatuses: SessionStatus[] = ["claimed", "availability_set", "scheduled", "completed", "needs_changes"];
  const activeP = supabase
    .from("sessions")
    .select(SESSION_SELECT)
    .or(`requester_id.eq.${uid},tutor_id.eq.${uid}`)
    .in("status", activeStatuses)
    .order("updated_at", { ascending: false });

  // My open requests (the "My Requests" strip with Cancel).
  const openP = supabase
    .from("sessions")
    .select(SESSION_SELECT)
    .eq("requester_id", uid)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  // Past: last 10 verified or cancelled rows touching me (either direction).
  const pastP = supabase
    .from("sessions")
    .select(SESSION_SELECT)
    .or(`requester_id.eq.${uid},tutor_id.eq.${uid}`)
    .in("status", ["verified", "cancelled"])
    .order("updated_at", { ascending: false })
    .limit(10);

  const [ledger, approvals, tutored, received, active, open, past] = await Promise.all([
    ledgerP,
    approvalsP,
    tutoredP,
    receivedP,
    activeP,
    openP,
    pastP,
  ]);

  const firstError =
    ledger.error || approvals.error || tutored.error || received.error || active.error || open.error || past.error;
  if (firstError) {
    return serverError("server_error", "Failed to load dashboard");
  }

  const volunteerHours = (ledger.data ?? []).reduce((sum, r) => sum + Number(r.hours ?? 0), 0);
  const shape = (rows: unknown): MemberSessionDTO[] =>
    ((rows as SessionWithJoins[]) ?? []).map((r) => toMemberSessionDTO(r, uid));

  return json({
    org: { id: orgId },
    stats: {
      volunteer_hours: Math.round(volunteerHours * 100) / 100,
      sessions_tutored: tutored.count ?? 0,
      sessions_received: received.count ?? 0,
      approved_subjects: approvals.count ?? 0,
    },
    open_requests: shape(open.data),
    sessions: shape(active.data),
    past: shape(past.data),
  });
}
