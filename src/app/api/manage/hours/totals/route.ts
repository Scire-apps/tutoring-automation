import { requireActiveManager } from "@/lib/auth";
import { listResponse, parseListParams, serverError } from "@/lib/http";
import { computeMemberTotals } from "@/lib/manage/hours";

export const dynamic = "force-dynamic";

/**
 * GET /api/manage/hours/totals ?q&limit&offset — per-member hours totals for the
 * org (§5.10), sorted by total descending. Each total is a ledger SUM (no cached
 * counter). Paginated over the aggregated roster. org_id is server-derived.
 */
export async function GET(req: Request) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const url = new URL(req.url);
  const { limit, offset } = parseListParams(url);
  const q = url.searchParams.get("q");

  try {
    const all = await computeMemberTotals(supabase, orgId, q);
    const page = all.slice(offset, offset + limit);
    return listResponse(page, all.length, { limit, offset });
  } catch {
    return serverError("server_error", "Failed to load hours totals");
  }
}
