import { after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { reasonSchema } from "@/lib/admin/schemas";
import { readAdminSession } from "@/lib/admin/sessions";
import { resolveRecipient } from "@/lib/admin/recipients";
import { toAdminSessionDTO } from "@/lib/admin/dtos";
import { sessionCancelled } from "@/lib/email";
import type { Database } from "@/types/database";

type SessionStatus = Database["public"]["Enums"]["session_status"];

export const dynamic = "force-dynamic";

/** An admin may cancel from any non-terminal state (mirrors the manager rule, §5.8). */
const CANCELLABLE: SessionStatus[] = [
  "open",
  "claimed",
  "availability_set",
  "scheduled",
  "completed",
  "needs_changes",
];

/**
 * POST /api/admin/sessions/[id]/cancel {reason} — an admin cancels a session
 * (§6.4). Same guarded UPDATE as the manager cancel but the ORG CHECK IS BYPASSED
 * (admin RLS via `is_admin()` authorizes cross-org). non-terminal→cancelled,
 * cancelled_by=the admin, reason shown to both parties. The sessions_audit trigger
 * records `session.cancelled`; both parties are emailed.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, reasonSchema);
  if (!parsed.ok) return parsed.response;
  const { reason } = parsed.data;

  const before = await readAdminSession(supabase, id);
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
    .in("status", CANCELLABLE)
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readAdminSession(supabase, id);
    if (!current) return notFound("not_found", "Session not found");
    return conflict("invalid_state", "The session could not be cancelled", { status: current.status });
  }

  const row = await readAdminSession(supabase, id);
  if (!row) return serverError("server_error", "Cancelled but the session could not be reloaded");
  const dto = toAdminSessionDTO(row);

  const [requester, tutor] = await Promise.all([
    resolveRecipient(supabase, before.requester_id),
    resolveRecipient(supabase, before.tutor_id),
  ]);
  const ctxEmail = { org_id: before.org_id, session_id: id, subjectName: dto.subject.name };
  if (requester) after(() => sessionCancelled(requester, ctxEmail, reason, { byManager: true }));
  if (tutor) after(() => sessionCancelled(tutor, ctxEmail, reason, { byManager: true }));

  return json(dto, 200);
}
