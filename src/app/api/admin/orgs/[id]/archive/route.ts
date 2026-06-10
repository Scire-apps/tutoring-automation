import { requireAdmin } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { readOrg, orgCounts } from "@/lib/admin/orgs";
import { toAdminOrgDTO } from "@/lib/admin/dtos";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/orgs/[id]/archive — archive an org (§6.3 / §6.4). Sets
 * archived_at (soft, ARCHIVE-ONLY — there is no org freeze flag): the org drops
 * out of signup dropdowns, no new requests/claims, the manager panel goes
 * read-only, but logins + hours history are retained. Idempotent-friendly: an
 * already-archived org → 409. The organizations_audit trigger records the change.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await ctx.params;

  const org = await readOrg(supabase, id);
  if (!org) return notFound("not_found", "Organization not found");
  if (org.archived_at != null) {
    return conflict("invalid_state", "This organization is already archived");
  }

  const { data, error } = await supabase
    .from("organizations")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .is("archived_at", null)
    .select("*")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!data) {
    const current = await readOrg(supabase, id);
    if (!current) return notFound("not_found", "Organization not found");
    return conflict("invalid_state", "This organization is already archived");
  }

  const counts = await orgCounts(supabase, id);
  return json(toAdminOrgDTO(data as Database["public"]["Tables"]["organizations"]["Row"], counts));
}
