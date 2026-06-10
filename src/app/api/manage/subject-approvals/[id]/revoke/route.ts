import { after } from "next/server";
import { requireActiveManager } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { revokeApprovalSchema } from "@/lib/manage/schemas";
import { readApproval } from "@/lib/manage/approvals";
import { toManageApprovalDTO } from "@/lib/manage/dtos";
import { resolveRecipient } from "@/lib/manage/recipients";
import { approvalDecision } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/manage/subject-approvals/[id]/revoke {note?} — revoke an APPROVED
 * approval (§5.6). Guarded UPDATE approved→revoked (soft — the row is never
 * deleted; the member sees a "Revoked" pill). The approvals_audit trigger records
 * `subject_approval.revoked`; a revocation email fires after the row returns.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, revokeApprovalSchema);
  if (!parsed.ok) return parsed.response;
  const note = parsed.data.note ?? null;

  const before = await readApproval(supabase, orgId, id);
  if (!before) return notFound("not_found", "Approval not found");
  if (before.status !== "approved") {
    return conflict("invalid_state", "Only an approved subject can be revoked", { status: before.status });
  }

  const { data: updated, error } = await supabase
    .from("subject_approvals")
    .update({
      status: "revoked",
      decision_note: note,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("status", "approved")
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readApproval(supabase, orgId, id);
    if (!current) return notFound("not_found", "Approval not found");
    return conflict("invalid_state", "The approval could not be revoked", { status: current.status });
  }

  const row = await readApproval(supabase, orgId, id);
  if (!row) return serverError("server_error", "Revoked but the approval could not be reloaded");
  const dto = toManageApprovalDTO(row);

  const recipient = await resolveRecipient(supabase, before.profile_id);
  if (recipient) {
    after(() => approvalDecision(recipient, dto.subject.name, "revoked", note, { org_id: orgId }));
  }

  return json(dto, 200);
}
