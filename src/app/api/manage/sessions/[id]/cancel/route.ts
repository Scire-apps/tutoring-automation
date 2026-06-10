import { after } from "next/server";
import { requireActiveManager } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { reasonSchema } from "@/lib/manage/schemas";
import { readManageSession } from "@/lib/manage/sessions";
import { toManageSessionDTO } from "@/lib/manage/dtos";
import { resolveRecipient } from "@/lib/manage/recipients";
import { sessionCancelled } from "@/lib/email";
import type { Database } from "@/types/database";

type SessionStatus = Database["public"]["Enums"]["session_status"];

export const dynamic = "force-dynamic";

/** A manager may cancel from any non-terminal state (§5.8 / sessions_guard). */
const CANCELLABLE: SessionStatus[] = [
  "open",
  "claimed",
  "availability_set",
  "scheduled",
  "completed",
  "needs_changes",
];

/**
 * POST /api/manage/sessions/[id]/cancel {reason} — a manager cancels a session
 * (§5.8). Guarded UPDATE non-terminal→cancelled (cancelled_by=manager, reason
 * shown to both parties). The sessions_audit trigger records `session.cancelled`;
 * both parties are emailed "cancelled by your organization". org_id is
 * server-derived; RLS (`managed_org`) authorizes the write.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, reasonSchema);
  if (!parsed.ok) return parsed.response;
  const { reason } = parsed.data;

  const before = await readManageSession(supabase, orgId, id);
  if (!before) return notFound("not_found", "Session not found");
  if (!CANCELLABLE.includes(before.status)) {
    return conflict("invalid_state", "This session can no longer be cancelled", { status: before.status });
  }

  const { data: updated, error } = await supabase
    .from("sessions")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.id,
      cancelled_reason: reason,
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .in("status", CANCELLABLE)
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readManageSession(supabase, orgId, id);
    if (!current) return notFound("not_found", "Session not found");
    return conflict("invalid_state", "The session could not be cancelled", { status: current.status });
  }

  const row = await readManageSession(supabase, orgId, id);
  if (!row) return serverError("server_error", "Cancelled but the session could not be reloaded");
  const dto = toManageSessionDTO(row);

  // Email both parties (requester always; tutor if one was claimed).
  const [requester, tutor] = await Promise.all([
    resolveRecipient(supabase, before.requester_id),
    resolveRecipient(supabase, before.tutor_id),
  ]);
  const ctxEmail = { org_id: orgId, session_id: id, subjectName: dto.subject.name };
  if (requester) after(() => sessionCancelled(requester, ctxEmail, reason, { byManager: true }));
  if (tutor) after(() => sessionCancelled(tutor, ctxEmail, reason, { byManager: true }));

  return json(dto, 200);
}
