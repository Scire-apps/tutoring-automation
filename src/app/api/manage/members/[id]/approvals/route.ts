import { requireActiveManager } from "@/lib/auth";
import { json, notFound, serverError } from "@/lib/http";
import { readOrgProfile } from "@/lib/manage/members";
import { MANAGE_APPROVAL_SELECT, refName, type ApprovalWithJoins } from "@/lib/manage/dtos";

export const dynamic = "force-dynamic";

/**
 * GET /api/manage/members/[id]/approvals — a member's subject approvals, all five
 * states (§5.5 Approvals tab). Flat triple + the decided-by display name. org_id
 * is server-derived; RLS scopes the read to the org.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const { id } = await ctx.params;

  const profile = await readOrgProfile(supabase, orgId, id, "member");
  if (!profile) return notFound("not_found", "Member not found");

  const { data, error } = await supabase
    .from("subject_approvals")
    .select(MANAGE_APPROVAL_SELECT)
    .eq("org_id", orgId)
    .eq("profile_id", id)
    .order("updated_at", { ascending: false });

  if (error) return serverError("server_error", "Failed to load approvals");

  const items = ((data as unknown as ApprovalWithJoins[]) ?? []).map((r) => ({
    id: r.id,
    org_subject_id: r.org_subject_id,
    name: r.subject?.name ?? "Unknown subject",
    category: r.subject?.category ?? null,
    grade_level: r.subject?.grade_level ?? null,
    status: r.status,
    evidence: r.evidence,
    decision_note: r.decision_note,
    direct_grant: r.direct_grant,
    decided_by_name: refName(r.decider) || null,
    decided_at: r.decided_at,
    created_at: r.created_at,
  }));

  return json({ items });
}
