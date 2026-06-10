import { requireActiveMember } from "@/lib/auth";
import { json, conflict, forbidden, notFound, serverError } from "@/lib/http";
import { readSession, toMemberSessionDTO } from "@/lib/member/session-dto";

export const dynamic = "force-dynamic";

/**
 * POST /api/member/sessions/[id]/complete — the claimer marks the session done
 * (§4.7). Legal from `scheduled` (claimer) and from `needs_changes` (a resubmit).
 * Requires a saved recording link → 409 `recording_required` otherwise (the table
 * CHECK demands recording_url + completed_at on `completed`; we pre-check for a
 * clean code). No email — the session enters the manager's verification queue.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveMember(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  const before = await readSession(supabase, id);
  if (!before) return notFound("not_found", "Session not found");
  if (before.tutor_id !== user.id) {
    return forbidden("forbidden", "Only the tutor can complete the session");
  }
  if (before.status !== "scheduled" && before.status !== "needs_changes") {
    return conflict("invalid_state", "Only a scheduled session can be completed", { status: before.status });
  }
  if (!before.recording_url) {
    return conflict("recording_required", "Add the recording link before completing the session");
  }

  const { data: updated, error } = await supabase
    .from("sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tutor_id", user.id)
    .in("status", ["scheduled", "needs_changes"])
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readSession(supabase, id);
    if (!current) return notFound("not_found", "Session not found");
    return conflict("invalid_state", "The session could not be completed", { status: current.status });
  }

  const row = await readSession(supabase, id);
  if (!row) return serverError("server_error", "Completed but the session could not be reloaded");
  return json(toMemberSessionDTO(row, user.id), 200);
}
