import { after } from "next/server";
import { requireActiveManager } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { reasonSchema } from "@/lib/manage/schemas";
import { readManageSession } from "@/lib/manage/sessions";
import { toManageSessionDTO } from "@/lib/manage/dtos";
import { resolveRecipient } from "@/lib/manage/recipients";
import { changesRequested, siteUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/manage/sessions/[id]/request-changes {reason} — a manager sends a
 * COMPLETED session back for changes (§5.9). Guarded UPDATE completed→needs_changes
 * with the reason stored as verification_note (the table CHECK keeps completed_at
 * + recording_url, so needs_changes is valid). The sessions_audit trigger records
 * `session.needs_changes`; the tutor is emailed to update + resubmit. (needs_changes
 * chosen over re-arming the scheduled state — it stays in the verification queue.)
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, reasonSchema);
  if (!parsed.ok) return parsed.response;
  const { reason } = parsed.data;

  const before = await readManageSession(supabase, orgId, id);
  if (!before) return notFound("not_found", "Session not found");
  if (before.status !== "completed") {
    return conflict("invalid_state", "Only a completed session can be sent back for changes", {
      status: before.status,
    });
  }

  const { data: updated, error } = await supabase
    .from("sessions")
    .update({ status: "needs_changes", verification_note: reason })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("status", "completed")
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readManageSession(supabase, orgId, id);
    if (!current) return notFound("not_found", "Session not found");
    return conflict("invalid_state", "Changes could not be requested", { status: current.status });
  }

  const row = await readManageSession(supabase, orgId, id);
  if (!row) return serverError("server_error", "Updated but the session could not be reloaded");
  const dto = toManageSessionDTO(row);

  const tutor = await resolveRecipient(supabase, before.tutor_id);
  if (tutor) {
    after(() =>
      changesRequested(
        tutor,
        { org_id: orgId, session_id: id, subjectName: dto.subject.name },
        reason,
        `${siteUrl()}/member/dashboard`,
      ),
    );
  }

  return json(dto, 200);
}
