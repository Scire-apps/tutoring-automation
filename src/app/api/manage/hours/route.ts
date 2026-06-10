import { requireActiveManager } from "@/lib/auth";
import { listResponse, parseListParams, serverError } from "@/lib/http";
import { LEDGER_SELECT, toLedgerEntryDTO, type LedgerWithJoins } from "@/lib/manage/dtos";

export const dynamic = "force-dynamic";

/**
 * GET /api/manage/hours ?member_id&limit&offset — the org-wide append-only hours
 * ledger (§5.10): date, member, ±hours, kind, session, awarded_by, note. Filter
 * by `member_id`. Newest first. org_id is server-derived; RLS (`managed_org`)
 * scopes the read to the org.
 */
export async function GET(req: Request) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const url = new URL(req.url);
  const { limit, offset } = parseListParams(url);
  const memberId = url.searchParams.get("member_id");

  let query = supabase
    .from("volunteer_hours_ledger")
    .select(LEDGER_SELECT, { count: "exact" })
    .eq("org_id", orgId)
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (memberId) query = query.eq("profile_id", memberId);

  const { data, error, count } = await query;
  if (error) return serverError("server_error", "Failed to load the hours ledger");

  const items = ((data as unknown as LedgerWithJoins[]) ?? []).map(toLedgerEntryDTO);
  return listResponse(items, count ?? 0, { limit, offset });
}
