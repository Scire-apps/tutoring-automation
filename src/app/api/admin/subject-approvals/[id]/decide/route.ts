import { after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { decideApprovalSchema } from "@/lib/admin/schemas";
import { readAdminApproval, readAdminApprovalWithJoins } from "@/lib/admin/sessions";
import { resolveRecipient } from "@/lib/admin/recipients";
import { toAdminApprovalDTO } from "@/lib/admin/dtos";
import { approvalDecision } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/subject-approvals/[id]/decide {action, note?} — decide a PENDING
 * subject-approval as an admin override (§6.4). Guarded UPDATE pending→approved|
 * rejected, stamping decided_by/at + decision_note. The approvals_audit trigger
 * records the decision; the member is emailed. Cross-org (admin RLS grants the
 * write). A re-decide hits the status guard → 409.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, decideApprovalSchema);
  if (!parsed.ok) return parsed.response;
  const newStatus = parsed.data.action === "approve" ? "approved" : "rejected";
  const note = parsed.data.note ?? null;

  const before = await readAdminApproval(supabase, id);
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
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readAdminApproval(supabase, id);
    if (!current) return notFound("not_found", "Approval request not found");
    return conflict("invalid_state", "The request could not be decided", { status: current.status });
  }

  const row = await readAdminApprovalWithJoins(supabase, id);
  if (!row) return serverError("server_error", "Decided but the approval could not be reloaded");
  const dto = toAdminApprovalDTO(row);

  const recipient = await resolveRecipient(supabase, before.profile_id);
  if (recipient) {
    after(() => approvalDecision(recipient, dto.subject.name, newStatus, note, { org_id: before.org_id }));
  }

  return json(dto, 200);
}
