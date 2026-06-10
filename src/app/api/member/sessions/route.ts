import { requireActiveMember } from "@/lib/auth";
import { json, conflict, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { createSessionSchema } from "@/lib/member/schemas";
import { SESSION_SELECT, toMemberSessionDTO, type SessionWithJoins } from "@/lib/member/session-dto";
import type { Database } from "@/types/database";

type SessionStatus = Database["public"]["Enums"]["session_status"];

export const dynamic = "force-dynamic";

/** Max simultaneous OPEN requests a member may hold (§2.9 / §7.2). */
const OPEN_REQUEST_LIMIT = 5;

const ACTIVE_FILTER: Record<string, SessionStatus[]> = {
  // The "?status" buckets the UI filters on; each maps to concrete enum states.
  open: ["open"],
  active: ["claimed", "availability_set", "scheduled", "completed", "needs_changes"],
  past: ["verified", "cancelled"],
};

const ALL_STATUSES = new Set<string>([
  "open",
  "claimed",
  "availability_set",
  "scheduled",
  "completed",
  "needs_changes",
  "verified",
  "cancelled",
]);

/**
 * GET /api/member/sessions ?role&status — the caller's sessions in either
 * direction (§7.2). `?role=requester|tutor` filters by side; `?status` accepts a
 * concrete enum value OR a bucket alias (open|active|past). Newest-updated first.
 * RLS keeps results to the caller's own + org rows.
 */
export async function GET(req: Request) {
  const auth = await requireActiveMember(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const url = new URL(req.url);
  const role = url.searchParams.get("role");
  const status = url.searchParams.get("status");

  let query = supabase.from("sessions").select(SESSION_SELECT);

  if (role === "requester") query = query.eq("requester_id", user.id);
  else if (role === "tutor") query = query.eq("tutor_id", user.id);
  else query = query.or(`requester_id.eq.${user.id},tutor_id.eq.${user.id}`);

  if (status) {
    const bucket = ACTIVE_FILTER[status];
    if (bucket) query = query.in("status", bucket);
    else if (ALL_STATUSES.has(status)) query = query.eq("status", status as SessionStatus);
  }

  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) return serverError("server_error", "Failed to load sessions");

  return json({
    items: ((data as unknown as SessionWithJoins[]) ?? []).map((r) => toMemberSessionDTO(r, user.id)),
  });
}

/**
 * POST /api/member/sessions — create a tutoring request (§4.5 / §7.2). The
 * subject must be in the caller's active catalog. A hard cap of 5 simultaneous
 * OPEN requests (the DB has no trigger for this; enforced here) → 409
 * `open_request_limit`. The row is pinned to `open`, requester = self, all
 * lifecycle fields NULL (the sessions_guard INSERT branch + table CHECKs enforce
 * this too). Returns the created session DTO.
 */
export async function POST(req: Request) {
  const auth = await requireActiveMember(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth;

  const parsed = await parseBody(req, createSessionSchema);
  if (!parsed.ok) return parsed.response;
  const { org_subject_id, location_preference, notes, language } = parsed.data;

  // Subject must be active and in the caller's org.
  const { data: subject } = await supabase
    .from("org_subjects")
    .select("id")
    .eq("id", org_subject_id)
    .eq("org_id", orgId)
    .eq("active", true)
    .maybeSingle();
  if (!subject) return conflict("invalid_state", "Subject not found in your organization");

  // Open-request cap.
  const { count, error: countErr } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("requester_id", user.id)
    .eq("status", "open");
  if (countErr) return serverError("server_error", "Failed to validate request limit");
  if ((count ?? 0) >= OPEN_REQUEST_LIMIT) {
    return conflict("open_request_limit", `You can have at most ${OPEN_REQUEST_LIMIT} open requests at a time`, {
      limit: OPEN_REQUEST_LIMIT,
    });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("sessions")
    .insert({
      org_id: orgId,
      requester_id: user.id,
      org_subject_id,
      status: "open",
      location_preference,
      notes,
      language: language ?? null,
    })
    .select(SESSION_SELECT)
    .maybeSingle();

  if (insErr) return serverError("server_error", insErr.message);
  if (!inserted) return serverError("server_error", "Failed to create request");

  return json(toMemberSessionDTO(inserted as unknown as SessionWithJoins, user.id), 201);
}
