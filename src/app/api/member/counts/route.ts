import { NextResponse } from "next/server";
import { requireActiveMember } from "@/lib/auth";
import { serverError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/member/counts — `{ action_count }`, `no-store` (§4.2 / §7.2). The
 * lightweight badge poll (60s + route change + focus) that replaces the old
 * 30s full-dashboard polling. `action_count` = sessions where it is the member's
 * turn to act:
 *   - as requester: a freshly `claimed` request awaiting their availability;
 *   - as tutor: `availability_set` (schedule), `needs_changes` (resubmit), or a
 *     `scheduled` session whose recording link is saved (ready to complete).
 */
export async function GET(req: Request) {
  const auth = await requireActiveMember(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const uid = user.id;

  const { data, error } = await supabase
    .from("sessions")
    .select("status, requester_id, tutor_id, recording_url")
    .or(`requester_id.eq.${uid},tutor_id.eq.${uid}`)
    .in("status", ["claimed", "availability_set", "scheduled", "needs_changes"]);

  if (error) return serverError("server_error", "Failed to load counts");

  let actionCount = 0;
  for (const s of data ?? []) {
    const isRequester = s.requester_id === uid;
    const isTutor = s.tutor_id === uid;
    if (isRequester && s.status === "claimed") {
      actionCount += 1;
    } else if (isTutor) {
      if (s.status === "availability_set" || s.status === "needs_changes") {
        actionCount += 1;
      } else if (s.status === "scheduled" && s.recording_url) {
        actionCount += 1;
      }
    }
  }

  return NextResponse.json(
    { action_count: actionCount },
    { headers: { "Cache-Control": "no-store" } },
  );
}
