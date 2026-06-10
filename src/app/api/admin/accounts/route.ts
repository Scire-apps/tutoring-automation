import { requireAdmin } from "@/lib/auth";
import { listResponse, parseListParams, serverError } from "@/lib/http";
import { ACCOUNT_SELECT, toAdminAccountDTO, type ProfileWithOrg, type AdminAccountDTO } from "@/lib/admin/dtos";
import { accountAggregatesFor } from "@/lib/admin/accounts";
import type { Database } from "@/types/database";

type AccountKind = Database["public"]["Enums"]["account_kind"];
type AccountStatus = Database["public"]["Enums"]["account_status"];

export const dynamic = "force-dynamic";

const KINDS: AccountKind[] = ["member", "manager", "admin"];
const STATUSES: AccountStatus[] = ["pending", "active", "suspended", "rejected"];

/**
 * GET /api/admin/accounts ?kind&status&org_id&q&limit&offset — the UNIFIED account
 * directory (§6.4): ONE collection powering the members, managers, AND admins
 * screens (the separate /api/admin/admins endpoint was deleted; the admins page
 * passes ?kind=admin). Filters are optional and ANDed; `q` matches name/email.
 * Each row carries its org. Newest-first, paginated. Cross-org by design.
 * requireAdmin gates.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const url = new URL(req.url);
  const { limit, offset } = parseListParams(url);

  const kindParam = url.searchParams.get("kind");
  const statusParam = url.searchParams.get("status");
  const orgId = url.searchParams.get("org_id");
  const q = (url.searchParams.get("q") || "").trim();

  let query = supabase
    .from("profiles")
    .select(ACCOUNT_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (kindParam && KINDS.includes(kindParam as AccountKind)) query = query.eq("kind", kindParam as AccountKind);
  if (statusParam && STATUSES.includes(statusParam as AccountStatus)) {
    query = query.eq("status", statusParam as AccountStatus);
  }
  if (orgId) query = query.eq("org_id", orgId);
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    query = query.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return serverError("server_error", "Failed to load accounts");

  const rows = (data as unknown as ProfileWithOrg[]) ?? [];
  const aggregates = await accountAggregatesFor(supabase, rows.map((r) => r.id));
  const items: AdminAccountDTO[] = rows.map((p) => toAdminAccountDTO(p, aggregates.get(p.id)));
  return listResponse(items, count ?? 0, { limit, offset });
}
