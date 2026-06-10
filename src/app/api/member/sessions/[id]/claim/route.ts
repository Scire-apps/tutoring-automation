import { after } from "next/server";
import { requireActiveMember } from "@/lib/auth";
import { json, conflict, forbidden, notFound, serverError } from "@/lib/http";
import { readSession, toMemberSessionDTO } from "@/lib/member/session-dto";
import { resolveRecipient } from "@/lib/member/recipients";
import { claimNotification, siteUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/member/sessions/[id]/claim — claim an open request (§4.6 / §7.6).
 *
 * The claim is ONE race-safe conditional UPDATE:
 *   SET status='claimed', tutor_id=self WHERE id=? AND status='open' RETURNING *
 * The sessions_guard trigger enforces the rest (`can_tutor`, tutor ≠ requester,
 * only the status and tutor columns change). Mapping the outcome:
 *   - 1 row  → 201, notify the requester to set availability (via after()).
 *   - DB error → inspect: not approved → 403 `not_approved_for_subject`;
 *     tutor = requester → 403 `own_request`.
 *   - 0 rows → re-read: invisible/missing → 404; otherwise already taken → 409
 *     `already_claimed`.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveMember(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  // Pre-check ownership: claiming your own request is `own_request` regardless of
  // approval status (the guard would otherwise surface a less specific error,
  // since can_tutor is evaluated before the tutor≠requester CHECK). A missing/
  // invisible row stays a 404. The atomic UPDATE below remains the race-safe path.
  const pre = await readSession(supabase, id);
  if (!pre) return notFound("not_found", "Session not found");
  if (pre.requester_id === user.id) return forbidden("own_request", "You cannot claim your own request");
  if (pre.status !== "open") {
    return conflict("already_claimed", "Someone beat you to this one", { status: pre.status });
  }

  const { data: updated, error } = await supabase
    .from("sessions")
    .update({ status: "claimed", tutor_id: user.id })
    .eq("id", id)
    .eq("status", "open")
    .select("id")
    .maybeSingle();

  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("not approved") || msg.includes("can_tutor")) {
      return forbidden("not_approved_for_subject", "You are not approved to tutor this subject");
    }
    if (msg.includes("tutor_not_requester") || msg.includes("requester") || error.code === "23514") {
      return forbidden("own_request", "You cannot claim your own request");
    }
    return serverError("server_error", error.message);
  }

  if (!updated) {
    // No row updated: figure out why via an RLS-bound re-read.
    const current = await readSession(supabase, id);
    if (!current) return notFound("not_found", "Session not found");
    if (current.requester_id === user.id) return forbidden("own_request", "You cannot claim your own request");
    return conflict("already_claimed", "Someone beat you to this one", { status: current.status });
  }

  // Success: hydrate the full row for the response + email context.
  const row = await readSession(supabase, id);
  if (!row) return serverError("server_error", "Claim succeeded but the session could not be reloaded");
  const dto = toMemberSessionDTO(row, user.id);

  // Notify the requester to set their availability (recipient resolved from the DB).
  const requester = await resolveRecipient(supabase, row.requester_id);
  if (requester) {
    const tutorName = `${row.tutor?.first_name ?? ""} ${row.tutor?.last_name ?? ""}`.trim() || "A tutor";
    after(() =>
      claimNotification(
        requester,
        tutorName,
        { org_id: row.org_id, session_id: row.id, subjectName: dto.subject.name },
        `${siteUrl()}/member/sessions/${row.id}/availability`,
      ),
    );
  }

  return json(dto, 201);
}
