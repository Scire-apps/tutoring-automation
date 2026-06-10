import { after } from "next/server";
import { requireActiveMember } from "@/lib/auth";
import { json, conflict, forbidden, notFound, serverError, validationError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { scheduleSchema } from "@/lib/member/schemas";
import { isValidIso, timeFitsAvailability } from "@/lib/domain";
import { readSession, toMemberSessionDTO } from "@/lib/member/session-dto";
import { resolveRecipient } from "@/lib/member/recipients";
import { sessionConfirmation, type SessionScheduleDetails } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/member/sessions/[id]/schedule — the claimer (tutor) picks the exact
 * slot (§4.7). Legal only from `availability_set` by the claimer. App-side
 * validation (lib/domain): valid ISO instant; the chosen start fits within the
 * requester's availability for that date; the slot duration EXACTLY equals the
 * requester's set `duration_minutes` (the schema dropped the desired/final split).
 * The sessions_guard backstops the transition. On success both parties get the
 * confirmation email.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveMember(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, scheduleSchema);
  if (!parsed.ok) return parsed.response;
  const { scheduled_at, date, start, duration_minutes, location } = parsed.data;

  if (!isValidIso(scheduled_at)) {
    return validationError([{ path: "scheduled_at", message: "Not a valid date/time" }]);
  }

  const before = await readSession(supabase, id);
  if (!before) return notFound("not_found", "Session not found");
  if (before.tutor_id !== user.id) {
    return forbidden("forbidden", "Only the tutor who claimed this can schedule it");
  }
  if (before.status !== "availability_set") {
    return conflict("invalid_state", "The session must have availability set before scheduling", {
      status: before.status,
    });
  }

  // Exact duration: must match the requester's chosen duration.
  if (before.duration_minutes != null && duration_minutes !== before.duration_minutes) {
    return validationError(
      [{ path: "duration_minutes", message: `Duration must be exactly ${before.duration_minutes} minutes` }],
      "Scheduled duration must match the requested duration",
    );
  }
  // Window fit: the chosen start+duration must sit inside the requester's availability for that date.
  const availability = (before.availability ?? null) as Record<string, unknown> | null;
  if (!timeFitsAvailability(availability, date, start, duration_minutes)) {
    return validationError(
      [{ path: "scheduled_at", message: "The selected time is outside the student's availability" }],
      "Pick a time within the student's availability",
    );
  }

  const { data: updated, error } = await supabase
    .from("sessions")
    .update({ status: "scheduled", scheduled_at, location: location ?? null })
    .eq("id", id)
    .eq("tutor_id", user.id)
    .eq("status", "availability_set")
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readSession(supabase, id);
    if (!current) return notFound("not_found", "Session not found");
    return conflict("invalid_state", "The session could not be scheduled", { status: current.status });
  }

  const row = await readSession(supabase, id);
  if (!row) return serverError("server_error", "Scheduled but the session could not be reloaded");
  const dto = toMemberSessionDTO(row, user.id);

  // Confirm both parties (recipients resolved from the DB).
  const [tutor, requester] = await Promise.all([
    resolveRecipient(supabase, row.tutor_id),
    resolveRecipient(supabase, row.requester_id),
  ]);
  if (tutor && requester) {
    const details: SessionScheduleDetails = {
      subjectName: dto.subject.name,
      date,
      time: start,
      location: dto.location_preference === "online" ? "Online" : row.location ?? "In person",
      durationMinutes: duration_minutes,
    };
    after(() => sessionConfirmation(tutor, requester, details, { org_id: row.org_id, session_id: row.id }));
  }

  return json(dto, 200);
}
