import { requireAdmin } from "@/lib/auth";
import { listResponse, parseListParams, serverError } from "@/lib/http";
import { ADMIN_SESSION_SELECT, toAdminSessionDTO, type SessionWithJoins } from "@/lib/admin/dtos";
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

/**
 * GET /api/admin/sessions ?org_id&status&q&limit&offset — cross-org session
 * oversight (§6.4). `status` accepts repeated or comma-separated values (no
 * default — all statuses when omitted); `org_id` scopes to one org; `q` matches
 * subject name or either party's name/email. Ordered priority DESC, created_at
 * DESC. Newest-first, paginated. requireAdmin gates.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const url = new URL(req.url);
  const { limit, offset } = parseListParams(url);

  const orgId = url.searchParams.get("org_id");
  const requested = url.searchParams
    .getAll("status")
    .flatMap((v) => v.split(","))
    .map((s) => s.trim())
    .filter((s): s is SessionStatus => STATUS_VALUES.includes(s as SessionStatus));
  const q = (url.searchParams.get("q") || "").trim();

  let query = supabase
    .from("sessions")
    .select(ADMIN_SESSION_SELECT, { count: "exact" })
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (orgId) query = query.eq("org_id", orgId);
  if (requested.length) query = query.in("status", requested);

  // `q` searches subject name + either party's name/email. Without an org scope
  // the helper-id resolution must span all orgs (admin RLS allows it).
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    let subjQuery = supabase.from("org_subjects").select("id").ilike("name", `%${safe}%`);
    let memQuery = supabase
      .from("profiles")
      .select("id")
      .or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`);
    if (orgId) {
      subjQuery = subjQuery.eq("org_id", orgId);
      memQuery = memQuery.eq("org_id", orgId);
    }
    const [subjRes, memRes] = await Promise.all([subjQuery.limit(500), memQuery.limit(500)]);
    const subjIds = (subjRes.data ?? []).map((s) => s.id);
    const memIds = (memRes.data ?? []).map((m) => m.id);
    const ors: string[] = [];
    if (subjIds.length) ors.push(`org_subject_id.in.(${subjIds.join(",")})`);
    if (memIds.length) {
      ors.push(`requester_id.in.(${memIds.join(",")})`);
      ors.push(`tutor_id.in.(${memIds.join(",")})`);
    }
    query = ors.length ? query.or(ors.join(",")) : query.eq("id", "00000000-0000-0000-0000-000000000000");
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return serverError("server_error", "Failed to load sessions");

  const items = ((data as unknown as SessionWithJoins[]) ?? []).map(toAdminSessionDTO);
  return listResponse(items, count ?? 0, { limit, offset });
}
