import { after } from "next/server";
import { requireActiveManager } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { verifySchema } from "@/lib/manage/schemas";
import { readManageSession } from "@/lib/manage/sessions";
import { toManageSessionDTO } from "@/lib/manage/dtos";
import { resolveRecipient } from "@/lib/manage/recipients";
import { hoursAwarded, siteUrl } from "@/lib/email";
import type { Database } from "@/types/database";

type SessionStatus = Database["public"]["Enums"]["session_status"];

export const dynamic = "force-dynamic";

/** Verify is legal from completed and from needs_changes (§5.9 / sessions_guard). */
const VERIFIABLE: SessionStatus[] = ["completed", "needs_changes"];

/**
 * POST /api/manage/sessions/[id]/verify {hours, note?} — verify a session and
 * award hours (§5.9 / §7.6). ONE guarded UPDATE sets verified_at/by + awarded_hours
 * + verification_note WHERE status IN (completed, needs_changes); the
 * `sessions_verify_award` definer trigger writes the ledger AWARD row atomically
 * (partial UNIQUE(session_id) makes double-award impossible) and the ledger_audit
 * trigger records `hours.awarded`. A re-verify hits the status guard → 409
 * invalid_state (zero double effects). hours ≥ 0.25 (the schema CHECK demands
 * > 0). The tutor is emailed. org_id is server-derived.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, verifySchema);
  if (!parsed.ok) return parsed.response;
  const { hours } = parsed.data;
  const note = parsed.data.note ?? null;

  const before = await readManageSession(supabase, orgId, id);
  if (!before) return notFound("not_found", "Session not found");
  if (!VERIFIABLE.includes(before.status)) {
    return conflict("invalid_state", "Only a completed session can be verified", { status: before.status });
  }

  const { data: updated, error } = await supabase
    .from("sessions")
    .update({
      status: "verified",
      verified_at: new Date().toISOString(),
      verified_by: user.id,
      awarded_hours: hours,
      verification_note: note,
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .in("status", VERIFIABLE)
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readManageSession(supabase, orgId, id);
    if (!current) return notFound("not_found", "Session not found");
    return conflict("invalid_state", "The session could not be verified", { status: current.status });
  }

  const row = await readManageSession(supabase, orgId, id);
  if (!row) return serverError("server_error", "Verified but the session could not be reloaded");
  const dto = toManageSessionDTO(row);

  const tutor = await resolveRecipient(supabase, before.tutor_id);
  if (tutor) {
    after(() =>
      hoursAwarded(tutor, dto.subject.name, hours, note, {
        org_id: orgId,
        session_id: id,
        hoursUrl: `${siteUrl()}/member/dashboard`,
      }),
    );
  }

  return json(dto, 200);
}
