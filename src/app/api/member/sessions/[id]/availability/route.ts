import { after } from "next/server";
import { requireActiveMember } from "@/lib/auth";
import { json, conflict, forbidden, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { availabilitySchema } from "@/lib/member/schemas";
import { readSession, toMemberSessionDTO } from "@/lib/member/session-dto";
import { resolveRecipient } from "@/lib/member/recipients";
import { availabilitySet, siteUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/member/sessions/[id]/availability — the requester sets (or edits)
 * their availability + duration (§4.7). Legal from `claimed` (first set, →
 * availability_set) or `availability_set` (edit, stays). A status-guarded UPDATE
 * scoped to requester = self; the sessions_guard enforces the transition and the
 * table CHECK enforces availability + duration presence. On the FIRST set the
 * tutor is notified to schedule (not on subsequent edits).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveMember(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, availabilitySchema);
  if (!parsed.ok) return parsed.response;
  const { availability, duration_minutes } = parsed.data;

  // Read current state to enforce role + know whether this is the first set.
  const before = await readSession(supabase, id);
  if (!before) return notFound("not_found", "Session not found");
  if (before.requester_id !== user.id) {
    return forbidden("forbidden", "Only the requester can set availability");
  }
  if (before.status !== "claimed" && before.status !== "availability_set") {
    return conflict("invalid_state", "Availability can only be set after a tutor claims the request", {
      status: before.status,
    });
  }
  const isFirstSet = before.status === "claimed";

  const { data: updated, error } = await supabase
    .from("sessions")
    .update({ status: "availability_set", availability, duration_minutes })
    .eq("id", id)
    .eq("requester_id", user.id)
    .in("status", ["claimed", "availability_set"])
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readSession(supabase, id);
    if (!current) return notFound("not_found", "Session not found");
    return conflict("invalid_state", "Availability could not be set", { status: current.status });
  }

  const row = await readSession(supabase, id);
  if (!row) return serverError("server_error", "Update succeeded but the session could not be reloaded");
  const dto = toMemberSessionDTO(row, user.id);

  if (isFirstSet) {
    const tutor = await resolveRecipient(supabase, row.tutor_id);
    if (tutor) {
      const requesterName = `${row.requester?.first_name ?? ""} ${row.requester?.last_name ?? ""}`.trim() || "Your student";
      after(() =>
        availabilitySet(
          tutor,
          requesterName,
          { org_id: row.org_id, session_id: row.id, subjectName: dto.subject.name },
          `${siteUrl()}/member/sessions/${row.id}/schedule`,
        ),
      );
    }
  }

  return json(dto, 200);
}
