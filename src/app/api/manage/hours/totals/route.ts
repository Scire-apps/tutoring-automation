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
    // Shape into the UI's nested {member, total_hours} row (the CSV export keeps
    // the flat shape; the lib is the single source for both).
    const page = all.slice(offset, offset + limit).map((t) => ({
      member: { id: t.profile_id, first_name: t.first_name, last_name: t.last_name, email: t.email },
      total_hours: t.total_hours,
    }));
    return listResponse(page, all.length, { limit, offset });
  } catch {
    return serverError("server_error", "Failed to load hours totals");
  }
}
