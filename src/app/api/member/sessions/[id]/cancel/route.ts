import { after } from "next/server";
import { requireActiveMember } from "@/lib/auth";
import { json, conflict, forbidden, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { cancelSchema } from "@/lib/member/schemas";
import { readSession, toMemberSessionDTO } from "@/lib/member/session-dto";
import { resolveRecipient } from "@/lib/member/recipients";
import { sessionCancelled } from "@/lib/email";
import type { Database } from "@/types/database";

type SessionStatus = Database["public"]["Enums"]["session_status"];

export const dynamic = "force-dynamic";

const PRE_COMPLETED: SessionStatus[] = ["open", "claimed", "availability_set", "scheduled"];

/**
 * POST /api/member/sessions/[id]/cancel — role-aware (§4.3 / §7.2).
 *   - REQUESTER: cancel any pre-completed status → terminal `cancelled`
 *     (cancelled_by = self, reason kept). If a tutor had claimed it, they're
 *     emailed that the session was cancelled.
 *   - CLAIMER (tutor): RELEASE the claim → back to `open`, clearing
 *     tutor/availability/duration/schedule/recording (identity + notes
 *     preserved). The requester is emailed that it returned to the board.
 * Nobody may cancel a completed|needs_changes|verified row (manager-only).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveMember(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, cancelSchema);
  if (!parsed.ok) return parsed.response;
  const reason = parsed.data.reason ?? null;

  const before = await readSession(supabase, id);
  if (!before) return notFound("not_found", "Session not found");

  const isRequester = before.requester_id === user.id;
  const isClaimer = before.tutor_id === user.id;
  if (!isRequester && !isClaimer) {
    return forbidden("forbidden", "You are not part of this session");
  }
  if (!PRE_COMPLETED.includes(before.status)) {
    return conflict("invalid_state", "This session can no longer be cancelled", { status: before.status });
  }

  if (isRequester) {
    // Terminal cancel.
    const { data: updated, error } = await supabase
      .from("sessions")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancelled_reason: reason,
      })
      .eq("id", id)
      .eq("requester_id", user.id)
      .in("status", PRE_COMPLETED)
      .select("id")
      .maybeSingle();

    if (error) return serverError("server_error", error.message);
    if (!updated) {
      const current = await readSession(supabase, id);
      if (!current) return notFound("not_found", "Session not found");
      return conflict("invalid_state", "The session could not be cancelled", { status: current.status });
    }

    const row = await readSession(supabase, id);
    if (!row) return serverError("server_error", "Cancelled but the session could not be reloaded");
    const dto = toMemberSessionDTO(row, user.id);

    // Notify the (ex-)claimer, if one existed before cancellation.
    const tutor = await resolveRecipient(supabase, before.tutor_id);
    if (tutor) {
      after(() =>
        sessionCancelled(
          tutor,
          { org_id: row.org_id, session_id: row.id, subjectName: dto.subject.name },
          reason ?? "",
          { byManager: false },
        ),
      );
    }
    return json(dto, 200);
  }

  // Claimer release → back to the board.
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
    .eq("tutor_id", user.id)
    .in("status", ["claimed", "availability_set", "scheduled"])
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readSession(supabase, id);
    if (!current) return notFound("not_found", "Session not found");
    return conflict("invalid_state", "The claim could not be released", { status: current.status });
  }

  const row = await readSession(supabase, id);
  if (!row) return serverError("server_error", "Released but the session could not be reloaded");
  const dto = toMemberSessionDTO(row, user.id);

  // Notify the requester their request is back on the board.
  const requester = await resolveRecipient(supabase, before.requester_id);
  if (requester) {
    after(() =>
      sessionCancelled(
        requester,
        { org_id: row.org_id, session_id: row.id, subjectName: dto.subject.name },
        "",
        { reopened: true },
      ),
    );
  }
  return json(dto, 200);
}
