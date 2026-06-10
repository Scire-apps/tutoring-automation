import { after } from "next/server";
import { requireActiveManager } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { decideApprovalSchema } from "@/lib/manage/schemas";
import { readApproval } from "@/lib/manage/approvals";
import { toManageApprovalDTO } from "@/lib/manage/dtos";
import { resolveRecipient } from "@/lib/manage/recipients";
import { approvalDecision } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/manage/subject-approvals/[id]/decide {action, note?} — review a
 * PENDING request (§5.6). Guarded UPDATE pending→approved|rejected, stamping
 * decided_by/at + decision_note. The approvals_audit trigger records
 * `subject_approval.approved|rejected`; a decision email fires after the row
 * returns. org_id is server-derived; RLS (`managed_org`) authorizes the write.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, decideApprovalSchema);
  if (!parsed.ok) return parsed.response;
  const newStatus = parsed.data.action === "approve" ? "approved" : "rejected";
  const note = parsed.data.note ?? null;

  const before = await readApproval(supabase, orgId, id);
  if (!before) return notFound("not_found", "Approval request not found");
  if (before.status !== "pending") {
    return conflict("invalid_state", "Only a pending request can be decided", { status: before.status });
  }

  const { data: updated, error } = await supabase
    .from("subject_approvals")
    .update({
      status: newStatus,
      decision_note: note,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readApproval(supabase, orgId, id);
    if (!current) return notFound("not_found", "Approval request not found");
    return conflict("invalid_state", "The request could not be decided", { status: current.status });
  }

  const row = await readApproval(supabase, orgId, id);
  if (!row) return serverError("server_error", "Decided but the approval could not be reloaded");
  const dto = toManageApprovalDTO(row);

  const recipient = await resolveRecipient(supabase, before.profile_id);
  if (recipient) {
    after(() => approvalDecision(recipient, dto.subject.name, newStatus, note, { org_id: orgId }));
  }

  return json(dto, 200);
}
