import { requireAdmin } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { patchOrgSchema } from "@/lib/admin/schemas";
import { readOrg, orgCounts, activeSlugTaken, nameTaken } from "@/lib/admin/orgs";
import { toAdminOrgDTO } from "@/lib/admin/dtos";
import type { Database } from "@/types/database";

type OrgUpdate = Database["public"]["Tables"]["organizations"]["Update"];

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/orgs/[id] — one org's header + membership counts (§6.3).
 * requireAdmin gates the route; admin reads archived + active orgs.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await ctx.params;

  const org = await readOrg(supabase, id);
  if (!org) return notFound("not_found", "Organization not found");
  const counts = await orgCounts(supabase, id);
  return json(toAdminOrgDTO(org, counts));
}

/**
 * PATCH /api/admin/orgs/[id] {name?, slug?} — rename / re-slug an org (§6.4). A
 * slug that collides with a DIFFERENT active org → 409 (the partial unique index
 * spans active orgs only); a name collision (name is globally UNIQUE) → 409. The
 * organizations_audit trigger records `org.updated`. Renaming an archived org is
 * allowed (its slug is freed); the slug check ignores other archived orgs.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, patchOrgSchema);
  if (!parsed.ok) return parsed.response;

  const before = await readOrg(supabase, id);
  if (!before) return notFound("not_found", "Organization not found");

  const update: OrgUpdate = {};
  if (parsed.data.name !== undefined && parsed.data.name !== before.name) {
    if (await nameTaken(supabase, parsed.data.name, id)) {
      return conflict("invalid_state", "An organization with that name already exists");
    }
    update.name = parsed.data.name;
  }
  if (parsed.data.slug !== undefined && parsed.data.slug !== before.slug) {
    // A non-archived org's slug must be unique among active orgs.
    if (before.archived_at == null && (await activeSlugTaken(supabase, parsed.data.slug, id))) {
      return conflict("invalid_state", "That slug is already in use by an active organization");
    }
    update.slug = parsed.data.slug;
  }

  if (Object.keys(update).length === 0) {
    const counts = await orgCounts(supabase, id);
    return json(toAdminOrgDTO(before, counts));
  }

  const { data, error } = await supabase
    .from("organizations")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return conflict("invalid_state", "That name or slug is already in use");
    }
    return serverError("server_error", error.message);
  }
  if (!data) return serverError("server_error", "Failed to update the organization");

  const counts = await orgCounts(supabase, id);
  return json(toAdminOrgDTO(data as Database["public"]["Tables"]["organizations"]["Row"], counts));
}

/**
 * DELETE /api/admin/orgs/[id] — hard-delete an org (§6.4). DB-LEVEL BACKSTOP ONLY:
 * the UI exposes archive, never delete. 204 only when the org has ZERO accounts
 * AND ZERO sessions; otherwise 409 `org_not_empty` (the org_id FKs are ON DELETE
 * RESTRICT, so a non-empty delete would fail regardless — this is the explicit,
 * friendly guard). Note: this frees the slug/name but does NOT delete the auth
 * users of any accounts (none can exist when this succeeds).
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await ctx.params;

  const org = await readOrg(supabase, id);
  if (!org) return notFound("not_found", "Organization not found");

  const head = { count: "exact" as const, head: true };
  const [accounts, sessions] = await Promise.all([
    supabase.from("profiles").select("id", head).eq("org_id", id),
    supabase.from("sessions").select("id", head).eq("org_id", id),
  ]);
  if ((accounts.count ?? 0) > 0 || (sessions.count ?? 0) > 0) {
    return conflict("org_not_empty", "Archive the organization instead — it still has accounts or sessions", {
      accounts: accounts.count ?? 0,
      sessions: sessions.count ?? 0,
    });
  }

  const { error } = await supabase.from("organizations").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return conflict("org_not_empty", "The organization still has dependent records");
    }
    return serverError("server_error", error.message);
  }
  return new Response(null, { status: 204 });
}
