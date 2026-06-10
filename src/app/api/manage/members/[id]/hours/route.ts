import { requireActiveManager } from "@/lib/auth";
import { json, notFound, parseListParams, serverError } from "@/lib/http";
import { readOrgProfile } from "@/lib/manage/members";
import { LEDGER_SELECT, refName, type LedgerWithJoins } from "@/lib/manage/dtos";

export const dynamic = "force-dynamic";

/**
 * GET /api/manage/members/[id]/hours — a member's volunteer-hours ledger + total
 * (§5.5 Hours tab). The total is the SUM over ALL the member's ledger rows (not
 * just the page); `items` is the paginated ledger (newest first), each flattened
 * to a display awarded-by name. org_id is server-derived; RLS scopes the reads.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const { id } = await ctx.params;
  const { limit, offset } = parseListParams(new URL(req.url));

  const profile = await readOrgProfile(supabase, orgId, id, "member");
  if (!profile) return notFound("not_found", "Member not found");

  const [pageRes, totalRes] = await Promise.all([
    supabase
      .from("volunteer_hours_ledger")
      .select(LEDGER_SELECT, { count: "exact" })
      .eq("org_id", orgId)
      .eq("profile_id", id)
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1),
    supabase.from("volunteer_hours_ledger").select("hours").eq("org_id", orgId).eq("profile_id", id),
  ]);

  if (pageRes.error || totalRes.error) return serverError("server_error", "Failed to load hours");

  const items = ((pageRes.data as unknown as LedgerWithJoins[]) ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    hours: Number(r.hours),
    note: r.note,
    session_id: r.session_id,
    awarded_by_name: refName(r.awarder) || null,
    created_at: r.created_at,
  }));
  const totalHours = (totalRes.data ?? []).reduce((sum, r) => sum + Number(r.hours ?? 0), 0);

  return json({
    total_hours: Math.round(totalHours * 100) / 100,
    items,
    total: pageRes.count ?? 0,
    limit,
    offset,
  });
}
