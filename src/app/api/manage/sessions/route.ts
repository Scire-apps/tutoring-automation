import { requireActiveManager } from "@/lib/auth";
import { listResponse, parseListParams, serverError } from "@/lib/http";
import { MANAGE_SESSION_SELECT, toManageSessionDTO, type SessionWithJoins } from "@/lib/manage/dtos";
import type { Database } from "@/types/database";

type SessionStatus = Database["public"]["Enums"]["session_status"];

export const dynamic = "force-dynamic";

const STATUS_VALUES: SessionStatus[] = [
  "open",
  "claimed",
  "availability_set",
  "scheduled",
  "completed",
  "needs_changes",
  "verified",
  "cancelled",
];

/** The default "active" view (everything not terminal) when no status is given. */
const ACTIVE_DEFAULT: SessionStatus[] = [
  "open",
  "claimed",
  "availability_set",
  "scheduled",
  "completed",
  "needs_changes",
];

/**
 * GET /api/manage/sessions ?status&subject_id&member_id&q&limit&offset — the org
 * session table (§5.8). `status` accepts MULTIPLE comma-separated values
 * (defaults to the active set); `member_id` matches either party. Ordered
 * priority DESC then created_at DESC (so high-priority rows surface first).
 * org_id is server-derived; RLS (`managed_org`) scopes the read to the org.
 */
export async function GET(req: Request) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const url = new URL(req.url);
  const { limit, offset } = parseListParams(url);

  const statusParam = url.searchParams.get("status");
  const requested = (statusParam ? statusParam.split(",") : [])
    .map((s) => s.trim())
    .filter((s): s is SessionStatus => STATUS_VALUES.includes(s as SessionStatus));
  const statuses = requested.length ? requested : ACTIVE_DEFAULT;

  const subjectId = url.searchParams.get("subject_id");
  const memberId = url.searchParams.get("member_id");

  let query = supabase
    .from("sessions")
    .select(MANAGE_SESSION_SELECT, { count: "exact" })
    .eq("org_id", orgId)
    .in("status", statuses)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (subjectId) query = query.eq("org_subject_id", subjectId);
  if (memberId) query = query.or(`requester_id.eq.${memberId},tutor_id.eq.${memberId}`);

  const { data, error, count } = await query;
  if (error) return serverError("server_error", "Failed to load sessions");

  const items = ((data as unknown as SessionWithJoins[]) ?? []).map(toManageSessionDTO);
  return listResponse(items, count ?? 0, { limit, offset });
}
