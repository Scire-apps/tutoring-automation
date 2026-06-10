import { requireActiveManager } from "@/lib/auth";
import { listResponse, parseListParams, serverError } from "@/lib/http";
import { toManageManagerDTO, type ManageManagerDTO } from "@/lib/manage/dtos";
import type { Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AccountStatus = Database["public"]["Enums"]["account_status"];

export const dynamic = "force-dynamic";

const STATUS_VALUES: AccountStatus[] = ["pending", "active", "suspended", "rejected"];

/**
 * GET /api/manage/managers ?status&limit&offset — the manager directory for MY
 * org (§5.7). Pending peers (awaiting activation) + active peers (read-only).
 * Defaults to all statuses ordered pending-first by recency. org_id is
 * server-derived; RLS (`managed_org`) scopes the read to the org.
 */
export async function GET(req: Request) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const url = new URL(req.url);
  const { limit, offset } = parseListParams(url);

  const statusParam = url.searchParams.get("status");
  const status = STATUS_VALUES.includes(statusParam as AccountStatus)
    ? (statusParam as AccountStatus)
    : null;

  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .eq("org_id", orgId)
    .eq("kind", "manager")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) return serverError("server_error", "Failed to load managers");

  const items: ManageManagerDTO[] = ((data as ProfileRow[]) ?? []).map(toManageManagerDTO);
  return listResponse(items, count ?? 0, { limit, offset });
}
