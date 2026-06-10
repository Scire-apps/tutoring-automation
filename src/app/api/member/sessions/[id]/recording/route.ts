import { requireActiveMember } from "@/lib/auth";
import { json, conflict, forbidden, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { recordingSchema } from "@/lib/member/schemas";
import { readSession, toMemberSessionDTO } from "@/lib/member/session-dto";

export const dynamic = "force-dynamic";

/**
 * PUT /api/member/sessions/[id]/recording — the claimer saves/edits the
 * recording link (§4.7). DECOUPLED from completion: editable in `scheduled` or
 * `needs_changes` ONLY (never while `completed` — the manager is reviewing the
 * link). A plain field edit (PUT per §7.1), status unchanged; the sessions_guard
 * permits recording writes for the claimer in exactly these two states. Returns
 * the updated session.
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveMember(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, recordingSchema);
  if (!parsed.ok) return parsed.response;
  const { recording_url } = parsed.data;

  const before = await readSession(supabase, id);
  if (!before) return notFound("not_found", "Session not found");
  if (before.tutor_id !== user.id) {
    return forbidden("forbidden", "Only the tutor can edit the recording link");
  }
  if (before.status !== "scheduled" && before.status !== "needs_changes") {
    return conflict("invalid_state", "You can only edit the recording link before completing the session", {
      status: before.status,
    });
  }

  const { data: updated, error } = await supabase
    .from("sessions")
    .update({ recording_url })
    .eq("id", id)
    .eq("tutor_id", user.id)
    .in("status", ["scheduled", "needs_changes"])
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readSession(supabase, id);
    if (!current) return notFound("not_found", "Session not found");
    return conflict("invalid_state", "The recording link could not be saved", { status: current.status });
  }

  const row = await readSession(supabase, id);
  if (!row) return serverError("server_error", "Saved but the session could not be reloaded");
  return json(toMemberSessionDTO(row, user.id), 200);
}
