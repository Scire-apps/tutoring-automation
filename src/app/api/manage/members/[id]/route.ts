import { requireActiveManager } from "@/lib/auth";
import { json, notFound, serverError } from "@/lib/http";
import { readOrgProfile, memberAggregate } from "@/lib/manage/members";
import { MANAGE_APPROVAL_SELECT, toManageApprovalDTO, type ApprovalWithJoins } from "@/lib/manage/dtos";

export const dynamic = "force-dynamic";

/**
 * GET /api/manage/members/[id] — member detail (§5.5): the profile, every
 * subject approval (all five states, with provenance), and the hours total
 * (ledger SUM). org_id is server-derived; RLS scopes both reads to the org and a
 * cross-org id reads back null → 404.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const { id } = await ctx.params;

  const profile = await readOrgProfile(supabase, orgId, id, "member");
  if (!profile) return notFound("not_found", "Member not found");

  const [approvalsRes, agg] = await Promise.all([
    supabase
      .from("subject_approvals")
      .select(MANAGE_APPROVAL_SELECT)
      .eq("org_id", orgId)
      .eq("profile_id", id)
      .order("updated_at", { ascending: false }),
    memberAggregate(supabase, orgId, id),
  ]);

  if (approvalsRes.error) return serverError("server_error", "Failed to load member");

  const approvals = ((approvalsRes.data as unknown as ApprovalWithJoins[]) ?? []).map(toManageApprovalDTO);

  return json({
    member: {
      id: profile.id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      email: profile.email,
      grade: profile.grade,
      pronouns: profile.pronouns,
      status: profile.status,
      status_note: profile.status_note,
      created_at: profile.created_at,
      activated_at: profile.activated_at,
    },
    approvals,
    approved_subjects: agg.approved_subjects,
    hours_total: agg.hours_total,
  });
}
