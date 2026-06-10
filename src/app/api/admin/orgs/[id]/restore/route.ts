import { requireAdmin } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { readOrg, orgCounts, activeSlugTaken, nameTaken } from "@/lib/admin/orgs";
import { toAdminOrgDTO } from "@/lib/admin/dtos";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/orgs/[id]/restore — un-archive an org (§6.3 / §6.4). Clears
 * archived_at, returning the org to signup dropdowns and an active manager panel.
 * Because archiving FREED the slug (the partial unique index spans active orgs),
 * restore RE-VALIDATES that the slug AND name don't now collide with a different
 * active org → 409 (the operator must rename/re-slug first). The organizations_audit
 * trigger records the change.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await ctx.params;

  const org = await readOrg(supabase, id);
  if (!org) return notFound("not_found", "Organization not found");
  if (org.archived_at == null) {
    return conflict("invalid_state", "This organization is not archived");
  }

  // Re-validate slug + name against the ACTIVE set (name is globally unique; slug
  // is unique among active orgs). A collision blocks restore.
  if (await activeSlugTaken(supabase, org.slug, id)) {
    return conflict("invalid_state", "Another active organization now uses this slug — change it before restoring", {
      field: "slug",
    });
  }
  if (await nameTaken(supabase, org.name, id)) {
    return conflict("invalid_state", "Another organization now uses this name — change it before restoring", {
      field: "name",
    });
  }

  const { data, error } = await supabase
    .from("organizations")
    .update({ archived_at: null })
    .eq("id", id)
    .not("archived_at", "is", null)
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return conflict("invalid_state", "That name or slug collides with an active organization");
    }
    return serverError("server_error", error.message);
  }
  if (!data) {
    const current = await readOrg(supabase, id);
    if (!current) return notFound("not_found", "Organization not found");
    return conflict("invalid_state", "This organization is not archived");
  }

  const counts = await orgCounts(supabase, id);
  return json(toAdminOrgDTO(data as Database["public"]["Tables"]["organizations"]["Row"], counts));
}
