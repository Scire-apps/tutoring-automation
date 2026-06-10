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

/** Claimed/availability_set/scheduled sessions can be reopened to the board (§5.8). */
const REOPENABLE: SessionStatus[] = ["claimed", "availability_set", "scheduled"];

/**
 * POST /api/manage/sessions/[id]/reopen {reason} — a manager returns a claimed
 * session to the board (§5.8). Guarded UPDATE {claimed,availability_set,
 * scheduled}→open, clearing tutor/availability/duration/schedule/recording (the
 * table CHECK demands open ⇒ those are NULL). The sessions_audit trigger records
 * `session.open`; both parties are emailed (the requester that it's claimable
 * again, the ex-tutor that the claim was released). org_id is server-derived.
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
  if (!REOPENABLE.includes(before.status)) {
    return conflict("invalid_state", "Only a claimed session can be reopened", { status: before.status });
  }

  const { data: updated, error } = await supabase
    .from("sessions")
    .update({
      status: "open",
      tutor_id: null,
      availability: null,
      duration_minutes: null,
      scheduled_at: null,
      location: null,
      recording_url: null,
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .in("status", REOPENABLE)
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readManageSession(supabase, orgId, id);
    if (!current) return notFound("not_found", "Session not found");
    return conflict("invalid_state", "The session could not be reopened", { status: current.status });
  }

  const row = await readManageSession(supabase, orgId, id);
  if (!row) return serverError("server_error", "Reopened but the session could not be reloaded");
  const dto = toManageSessionDTO(row);

  const ctxEmail = { org_id: orgId, session_id: id, subjectName: dto.subject.name };
  // Requester: back on the board.
  const requester = await resolveRecipient(supabase, before.requester_id);
  if (requester) after(() => sessionCancelled(requester, ctxEmail, reason, { reopened: true }));
  // Ex-tutor: the claim was released (only if there was one).
  if (before.tutor_id) {
    const tutor = await resolveRecipient(supabase, before.tutor_id);
    if (tutor) after(() => sessionCancelled(tutor, ctxEmail, reason, { reopened: true }));
  }

  return json(dto, 200);
}
