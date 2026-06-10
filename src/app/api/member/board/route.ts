import { requireActiveMember } from "@/lib/auth";
import { listResponse, parseListParams, serverError } from "@/lib/http";
import { SESSION_SELECT, toMemberSessionDTO, type SessionWithJoins } from "@/lib/member/session-dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/member/board ?subject_id&limit&offset — the org tutoring board
 * (§4.6 / §7.2). Open requests in the caller's org EXCLUDING their own, each
 * annotated with `can_claim` (true iff the caller holds an `approved` approval
 * for that exact `org_subject_id`). Ordered priority DESC, created_at DESC and
 * every row carries `priority` for badges. Paginated `{items,total,limit,offset}`.
 *
 * RLS already restricts SELECT to open org rows; the `requester_id != self`
 * filter drops the caller's own requests (self-claim is server-blocked anyway).
 */
export async function GET(req: Request) {
  const auth = await requireActiveMember(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth;
  const url = new URL(req.url);
  const { limit, offset } = parseListParams(url);
  const subjectId = url.searchParams.get("subject_id");

  // The caller's approved subject ids (drives can_claim).
  const approvedP = supabase
    .from("subject_approvals")
    .select("org_subject_id")
    .eq("profile_id", user.id)
    .eq("status", "approved");

  let query = supabase
    .from("sessions")
    .select(SESSION_SELECT, { count: "exact" })
    .eq("org_id", orgId)
    .eq("status", "open")
    .neq("requester_id", user.id)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (subjectId) query = query.eq("org_subject_id", subjectId);

  const [approved, board] = await Promise.all([approvedP, query]);
  if (approved.error || board.error) {
    return serverError("server_error", "Failed to load the board");
  }

  const approvedSet = new Set((approved.data ?? []).map((a) => a.org_subject_id));
  const items = ((board.data as unknown as SessionWithJoins[]) ?? []).map((row) => ({
    ...toMemberSessionDTO(row, user.id),
    can_claim: approvedSet.has(row.org_subject_id),
  }));

  return listResponse(items, board.count ?? 0, { limit, offset });
}
