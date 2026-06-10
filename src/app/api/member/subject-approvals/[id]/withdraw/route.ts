import { requireActiveMember } from "@/lib/auth";
import { json, conflict, notFound } from "@/lib/http";
import { APPROVAL_SELECT, toMemberApprovalDTO, type ApprovalWithSubject } from "@/lib/member/approval-dto";

export const dynamic = "force-dynamic";

/**
 * POST /api/member/subject-approvals/[id]/withdraw — pull a pending request
 * (§4.8). A status-guarded UPDATE `pending → withdrawn` scoped to the caller's
 * own row (RLS + `profile_id = self`). Zero rows → re-read to map 404 (missing/
 * not yours) vs 409 (not pending). Fully soft — the row is never deleted.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveMember(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  const { data: updated } = await supabase
    .from("subject_approvals")
    .update({ status: "withdrawn" })
    .eq("id", id)
    .eq("profile_id", user.id)
    .eq("status", "pending")
    .select(APPROVAL_SELECT)
    .maybeSingle();

  if (updated) return json(toMemberApprovalDTO(updated as unknown as ApprovalWithSubject), 200);

  // Disambiguate the no-op.
  const { data: current } = await supabase
    .from("subject_approvals")
    .select("status")
    .eq("id", id)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!current) return notFound("not_found", "Approval request not found");
  return conflict("invalid_state", "Only a pending request can be withdrawn", { status: current.status });
}
