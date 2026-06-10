import { requireAdmin } from "@/lib/auth";
import { json, notFound, serverError } from "@/lib/http";
import { readAdminSession } from "@/lib/admin/sessions";
import {
  ADMIN_AUDIT_SELECT,
  toAdminSessionDTO,
  toAdminAuditDTO,
  type AuditWithJoins,
} from "@/lib/admin/dtos";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/sessions/[id] — one session's full record (incl. recording_url)
 * plus its transition timeline (§6.4). The timeline is the audit rows scoped to
 * this session (`target_table='sessions' AND target_id=id`), oldest-first. Cross-org
 * admin read. requireAdmin gates.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await ctx.params;

  const row = await readAdminSession(supabase, id);
  if (!row) return notFound("not_found", "Session not found");

  const { data: auditData, error } = await supabase
    .from("audit_log")
    .select(ADMIN_AUDIT_SELECT)
    .eq("target_table", "sessions")
    .eq("target_id", id)
    .order("id", { ascending: true });

  if (error) return serverError("server_error", "Failed to load the session timeline");

  const timeline = ((auditData as unknown as AuditWithJoins[]) ?? []).map(toAdminAuditDTO);
  return json({ session: toAdminSessionDTO(row), timeline });
}
