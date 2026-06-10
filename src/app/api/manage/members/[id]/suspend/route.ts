import { after } from "next/server";
import { requireActiveManager } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { suspendSchema } from "@/lib/manage/schemas";
import { readOrgProfile, orgNameFor } from "@/lib/manage/members";
import { resolveRecipient } from "@/lib/manage/recipients";
import { MANAGE_SESSION_SELECT, toManageSessionDTO, type SessionWithJoins } from "@/lib/manage/dtos";
import { accountStatusChanged, sessionCancelled } from "@/lib/email";
import { logAudit } from "@/lib/log";
import type { Database } from "@/types/database";

type SessionStatus = Database["public"]["Enums"]["session_status"];

export const dynamic = "force-dynamic";

/** Active session statuses where the member is the CLAIMER → released to open. */
const RELEASABLE: SessionStatus[] = ["claimed", "availability_set", "scheduled"];
/** Statuses where the member's OWN open request is cancellable in the cascade. */
const REQUESTER_CANCELLABLE: SessionStatus[] = ["open", "claimed", "availability_set", "scheduled"];

/**
 * POST /api/manage/members/[id]/suspend — suspend an active member (§5.5 / §7.2).
 * Guarded UPDATE active→suspended (note → status_note, member-visible). When
 * `cancel_active` (default true) the cascade runs as bulk status-guarded UPDATEs:
 *   - requests the member OPENED → cancelled (cancelled_by=manager, reason set);
 *   - sessions the member CLAIMED → released back to open (tutor/availability/
 *     schedule/recording cleared).
 * The sessions_audit trigger records each transition; a supplementary
 * `member.session_cancelled|released` audit row carries `{cause:member_suspended}`.
 * Each affected counterpart is emailed. The profiles_audit trigger records the
 * `member.suspended` row; a suspension email fires after the status flips.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, suspendSchema);
  if (!parsed.ok) return parsed.response;
  const note = parsed.data.note ?? null;
  const cancelActive = parsed.data.cancel_active;

  const before = await readOrgProfile(supabase, orgId, id, "member");
  if (!before) return notFound("not_found", "Member not found");
  if (before.status !== "active") {
    return conflict("invalid_state", "Only an active member can be suspended", { status: before.status });
  }

  // 1) Flip the member to suspended (guarded; the trigger audits member.suspended).
  const { data: flipped, error: flipErr } = await supabase
    .from("profiles")
    .update({ status: "suspended", status_note: note })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (flipErr) return serverError("server_error", flipErr.message);
  if (!flipped) {
    const current = await readOrgProfile(supabase, orgId, id, "member");
    if (!current) return notFound("not_found", "Member not found");
    return conflict("invalid_state", "The member could not be suspended", { status: current.status });
  }

  let cancelledRequests = 0;
  let releasedClaims = 0;

  if (cancelActive) {
    // 2a) Cancel the member's own open/active requests (elevated manager edge).
    const { data: ownRows } = await supabase
      .from("sessions")
      .select(MANAGE_SESSION_SELECT)
      .eq("org_id", orgId)
      .eq("requester_id", id)
      .in("status", REQUESTER_CANCELLABLE);

    for (const raw of (ownRows as unknown as SessionWithJoins[]) ?? []) {
      const { data: upd } = await supabase
        .from("sessions")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
          cancelled_reason: "The requester's account was suspended",
        })
        .eq("id", raw.id)
        .eq("org_id", orgId)
        .in("status", REQUESTER_CANCELLABLE)
        .select("id")
        .maybeSingle();
      if (!upd) continue;
      cancelledRequests += 1;
      const dto = toManageSessionDTO(raw);
      after(() =>
        logAudit({
          action: "member.session_cancelled",
          actor_id: user.id,
          actor_kind: "manager",
          org_id: orgId,
          target_table: "sessions",
          target_id: raw.id,
          metadata: { cause: "member_suspended", member_id: id },
        }),
      );
      // Notify the (ex-)claimer, if any, that the session was cancelled.
      if (raw.tutor_id) {
        const tutor = await resolveRecipient(supabase, raw.tutor_id);
        if (tutor) {
          after(() =>
            sessionCancelled(
              tutor,
              { org_id: orgId, session_id: raw.id, subjectName: dto.subject.name },
              "The requester's account was suspended",
              { byManager: true },
            ),
          );
        }
      }
    }

    // 2b) Release sessions the member CLAIMED back to the board (elevated edge).
    const { data: claimedRows } = await supabase
      .from("sessions")
      .select(MANAGE_SESSION_SELECT)
      .eq("org_id", orgId)
      .eq("tutor_id", id)
      .in("status", RELEASABLE);

    for (const raw of (claimedRows as unknown as SessionWithJoins[]) ?? []) {
      const { data: upd } = await supabase
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
        .eq("id", raw.id)
        .eq("org_id", orgId)
        .eq("tutor_id", id)
        .in("status", RELEASABLE)
        .select("id")
        .maybeSingle();
      if (!upd) continue;
      releasedClaims += 1;
      const dto = toManageSessionDTO(raw);
      after(() =>
        logAudit({
          action: "member.session_released",
          actor_id: user.id,
          actor_kind: "manager",
          org_id: orgId,
          target_table: "sessions",
          target_id: raw.id,
          metadata: { cause: "member_suspended", member_id: id },
        }),
      );
      // Notify the requester their request is back on the board.
      const requester = await resolveRecipient(supabase, raw.requester_id);
      if (requester) {
        after(() =>
          sessionCancelled(
            requester,
            { org_id: orgId, session_id: raw.id, subjectName: dto.subject.name },
            "",
            { reopened: true },
          ),
        );
      }
    }
  }

  // 3) Suspension email to the member.
  const orgName = await orgNameFor(supabase, orgId);
  const recipient = { email: before.email, name: before.first_name, id: before.id };
  after(() => accountStatusChanged(recipient, orgName, "suspended", "suspended", note, { org_id: orgId }));

  return json({
    id,
    status: "suspended" as const,
    cancelled_requests: cancelledRequests,
    released_claims: releasedClaims,
  });
}
