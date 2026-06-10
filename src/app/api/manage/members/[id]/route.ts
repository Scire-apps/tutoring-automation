import { requireActiveManager } from "@/lib/auth";
import { json, notFound } from "@/lib/http";
import { readOrgProfile, memberAggregate } from "@/lib/manage/members";

export const dynamic = "force-dynamic";

/**
 * GET /api/manage/members/[id] — member detail (§5.5): the profile + the hours
 * total (ledger SUM) + activity counts (open requests, active sessions). The
 * Approvals / Sessions / Hours tabs fetch their own sub-resources. org_id is
 * server-derived; RLS scopes the read to the org and a cross-org id reads back
 * null → 404.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const { id } = await ctx.params;

  const profile = await readOrgProfile(supabase, orgId, id, "member");
  if (!profile) return notFound("not_found", "Member not found");

  const agg = await memberAggregate(supabase, orgId, id);

  return json({
    id: profile.id,
    first_name: profile.first_name,
    last_name: profile.last_name,
    email: profile.email,
    status: profile.status,
    grade: profile.grade,
    pronouns: profile.pronouns,
    status_note: profile.status_note,
    total_hours: agg.hours_total,
    open_requests_count: agg.open_requests,
    active_sessions_count: agg.active_sessions,
    created_at: profile.created_at,
  });
}
