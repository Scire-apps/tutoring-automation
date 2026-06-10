import { after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { verifySchema } from "@/lib/admin/schemas";
import { readAdminSession } from "@/lib/admin/sessions";
import { resolveRecipient } from "@/lib/admin/recipients";
import { toAdminSessionDTO } from "@/lib/admin/dtos";
import { hoursAwarded, siteUrl } from "@/lib/email";
import type { Database } from "@/types/database";

type SessionStatus = Database["public"]["Enums"]["session_status"];

export const dynamic = "force-dynamic";

/** Verify is legal from completed and from needs_changes (§5.9 / sessions_guard). */
const VERIFIABLE: SessionStatus[] = ["completed", "needs_changes"];

/**
 * POST /api/admin/sessions/[id]/verify {awarded_hours, note?} — an admin verifies a
 * session and awards hours (§6.4 / §7.6). The SAME guarded UPDATE as the manager
 * verify but the ORG CHECK IS BYPASSED: ONE UPDATE sets verified_at/by +
 * awarded_hours + verification_note WHERE status IN (completed, needs_changes); the
 * `sessions_verify_award` definer trigger writes the ledger AWARD row atomically
 * (partial UNIQUE(session_id) makes double-award impossible). A re-verify hits the
 * status guard → 409. awarded_hours ≥ 0.25 (the schema CHECK demands > 0). The
 * tutor is emailed.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, verifySchema);
  if (!parsed.ok) return parsed.response;
  const hours = parsed.data.awarded_hours;
  const note = parsed.data.note ?? null;

  const before = await readAdminSession(supabase, id);
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
    .in("status", VERIFIABLE)
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readAdminSession(supabase, id);
    if (!current) return notFound("not_found", "Session not found");
    return conflict("invalid_state", "The session could not be verified", { status: current.status });
  }

  const row = await readAdminSession(supabase, id);
  if (!row) return serverError("server_error", "Verified but the session could not be reloaded");
  const dto = toAdminSessionDTO(row);

  const tutor = await resolveRecipient(supabase, before.tutor_id);
  if (tutor) {
    after(() =>
      hoursAwarded(tutor, dto.subject.name, hours, note, {
        org_id: before.org_id,
        session_id: id,
        hoursUrl: `${siteUrl()}/member/dashboard`,
      }),
    );
  }

  return json(dto, 200);
}
