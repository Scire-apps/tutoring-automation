import { requireActiveManager } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { prioritySchema } from "@/lib/manage/schemas";
import { readManageSession } from "@/lib/manage/sessions";
import {
  AUDIT_SELECT,
  toManageSessionDTO,
  toAuditEntryDTO,
  type AuditWithActor,
} from "@/lib/manage/dtos";
import type { Database } from "@/types/database";

type SessionStatus = Database["public"]["Enums"]["session_status"];

export const dynamic = "force-dynamic";

const TERMINAL: SessionStatus[] = ["verified", "cancelled"];

/**
 * GET /api/manage/sessions/[id] — session detail + audit timeline (§5.8). The
 * timeline is every audit_log row targeting this session (the transition history,
 * trigger-written), oldest-first. org_id is server-derived; RLS scopes both reads.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const { id } = await ctx.params;

  const row = await readManageSession(supabase, orgId, id);
  if (!row) return notFound("not_found", "Session not found");

  const { data: auditRows, error } = await supabase
    .from("audit_log")
    .select(AUDIT_SELECT)
    .eq("org_id", orgId)
    .eq("target_table", "sessions")
    .eq("target_id", id)
    .order("id", { ascending: true });

  if (error) return serverError("server_error", "Failed to load the session timeline");

  const timeline = ((auditRows as unknown as AuditWithActor[]) ?? []).map(toAuditEntryDTO);
  return json({ session: toManageSessionDTO(row), timeline });
}

/**
 * PATCH /api/manage/sessions/[id] {priority} — triage a session's priority
 * (§5.8). The one mutation that is audited but sends NO party-facing email
 * (internal triage metadata; the sessions_audit trigger records `session.updated`).
 * Members never set priority. Terminal sessions reject. org_id is server-derived.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, prioritySchema);
  if (!parsed.ok) return parsed.response;
  const { priority } = parsed.data;

  const before = await readManageSession(supabase, orgId, id);
  if (!before) return notFound("not_found", "Session not found");
  if (TERMINAL.includes(before.status)) {
    return conflict("invalid_state", "A finished session's priority cannot be changed", {
      status: before.status,
    });
  }

  const { data: updated, error } = await supabase
    .from("sessions")
    .update({ priority })
    .eq("id", id)
    .eq("org_id", orgId)
    .not("status", "in", "(verified,cancelled)")
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readManageSession(supabase, orgId, id);
    if (!current) return notFound("not_found", "Session not found");
    return conflict("invalid_state", "The session priority could not be changed", { status: current.status });
  }

  const row = await readManageSession(supabase, orgId, id);
  if (!row) return serverError("server_error", "Updated but the session could not be reloaded");
  return json(toManageSessionDTO(row), 200);
}
