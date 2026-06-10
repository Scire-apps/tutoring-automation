import { requireActiveMember } from "@/lib/auth";
import { json, notFound } from "@/lib/http";
import { readSession, toMemberSessionDTO } from "@/lib/member/session-dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/member/sessions/[id] — one session, role-annotated for the caller
 * (§7.2). RLS makes a row the caller may not see indistinguishable from a
 * missing one → 404 `not_found` (cross-org probes leak nothing, §7.1).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveMember(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  const row = await readSession(supabase, id);
  if (!row) return notFound("not_found", "Session not found");
  return json(toMemberSessionDTO(row, user.id));
}
