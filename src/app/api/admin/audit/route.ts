import { requireAdmin } from "@/lib/auth";
import { listResponse, parseListParams, serverError } from "@/lib/http";
import { ADMIN_AUDIT_SELECT, toAdminAuditDTO, type AuditWithJoins } from "@/lib/admin/dtos";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/audit ?org_id&actor_id&action&target_table&from&to&limit&offset —
 * the filterable platform audit viewer (§6.4). Every filter is optional and ANDed;
 * `action` matches a prefix (e.g. `session.` → all session events); `from`/`to`
 * bound created_at. Newest-first, paginated. Cross-org by design (admin sees all
 * audit rows incl. org_id NULL system rows). Expandable metadata JSON ships in the
 * row. requireAdmin gates the route.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const url = new URL(req.url);
  const { limit, offset } = parseListParams(url);

  const orgId = url.searchParams.get("org_id");
  const actorId = url.searchParams.get("actor_id");
  const action = (url.searchParams.get("action") || "").trim();
  const targetTable = url.searchParams.get("target_table");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let query = supabase
    .from("audit_log")
    .select(ADMIN_AUDIT_SELECT, { count: "exact" })
    .order("id", { ascending: false });

  if (orgId) query = query.eq("org_id", orgId);
  if (actorId) query = query.eq("actor_id", actorId);
  if (action) {
    // Exact action match, or a dotted prefix (`session.` matches session.*).
    query = action.endsWith(".")
      ? query.like("action", `${action.replace(/[%_]/g, "")}%`)
      : query.eq("action", action);
  }
  if (targetTable) query = query.eq("target_table", targetTable);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return serverError("server_error", "Failed to load the audit log");

  const items = ((data as unknown as AuditWithJoins[]) ?? []).map(toAdminAuditDTO);
  return listResponse(items, count ?? 0, { limit, offset });
}
