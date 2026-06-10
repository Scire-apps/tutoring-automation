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

  // `status` accepts BOTH repeated params (?status=a&status=b) and a single
  // comma-separated value (?status=a,b); empty → the active default set.
  const requested = url.searchParams
    .getAll("status")
    .flatMap((v) => v.split(","))
    .map((s) => s.trim())
    .filter((s): s is SessionStatus => STATUS_VALUES.includes(s as SessionStatus));
  const statuses = requested.length ? requested : ACTIVE_DEFAULT;

  const subjectId = url.searchParams.get("subject_id");
  const memberId = url.searchParams.get("member_id");
  const q = (url.searchParams.get("q") || "").trim();
  // The verification queue wants oldest-first; the table defaults priority DESC.
  const oldestFirst = url.searchParams.get("order") === "oldest";

  let query = supabase
    .from("sessions")
    .select(MANAGE_SESSION_SELECT, { count: "exact" })
    .eq("org_id", orgId)
    .in("status", statuses);

  query = oldestFirst
    ? query.order("created_at", { ascending: true })
    : query.order("priority", { ascending: false }).order("created_at", { ascending: false });

  if (subjectId) query = query.eq("org_subject_id", subjectId);
  if (memberId) query = query.or(`requester_id.eq.${memberId},tutor_id.eq.${memberId}`);

  // `q` searches subject name + either party's name/email; resolve matching
  // subject + member ids in-org, then restrict the session set to either match.
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    const [subjRes, memRes] = await Promise.all([
      supabase.from("org_subjects").select("id").eq("org_id", orgId).ilike("name", `%${safe}%`),
      supabase
        .from("profiles")
        .select("id")
        .eq("org_id", orgId)
        .or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`),
    ]);
    const subjIds = (subjRes.data ?? []).map((s) => s.id);
    const memIds = (memRes.data ?? []).map((m) => m.id);
    const ors: string[] = [];
    if (subjIds.length) ors.push(`org_subject_id.in.(${subjIds.join(",")})`);
    if (memIds.length) {
      ors.push(`requester_id.in.(${memIds.join(",")})`);
      ors.push(`tutor_id.in.(${memIds.join(",")})`);
    }
    // No textual match anywhere → force an empty page.
    query = ors.length ? query.or(ors.join(",")) : query.eq("id", "00000000-0000-0000-0000-000000000000");
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return serverError("server_error", "Failed to load sessions");

  const items = ((data as unknown as SessionWithJoins[]) ?? []).map(toManageSessionDTO);
  return listResponse(items, count ?? 0, { limit, offset });
}
