import { requireActiveManager } from "@/lib/auth";
import { json, badRequest, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { patchSubjectSchema } from "@/lib/manage/schemas";
import type { Database } from "@/types/database";

type SubjectRow = Database["public"]["Tables"]["org_subjects"]["Row"];
type SubjectUpdate = Database["public"]["Tables"]["org_subjects"]["Update"];

export const dynamic = "force-dynamic";

/**
 * PATCH /api/manage/subjects/[id] — edit an org subject (§5.11): rename /
 * recategorize / regrade and/or toggle `active` (soft-deactivate — there is NO
 * delete route; hard delete stays admin-only). A rename that collides with an
 * existing triple is 409. The org_subjects_audit trigger records the rename's
 * activation change; renames propagate via the session/approval FKs (fixes
 * substring matching). org_id is server-derived; RLS (`managed_org`) authorizes.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, patchSubjectSchema);
  if (!parsed.ok) return parsed.response;

  // Scope existence to the org (RLS already hides cross-org rows; this 404s cleanly).
  const { data: before } = await supabase
    .from("org_subjects")
    .select("id")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!before) return notFound("not_found", "Subject not found");

  const patch: SubjectUpdate = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.category !== undefined) patch.category = parsed.data.category;
  if (parsed.data.grade_level !== undefined) patch.grade_level = parsed.data.grade_level;
  if (parsed.data.active !== undefined) patch.active = parsed.data.active;

  if (Object.keys(patch).length === 0) {
    return badRequest("validation_error", "No changes provided");
  }

  const { data, error } = await supabase
    .from("org_subjects")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return conflict("invalid_state", "Another subject with that name/category/grade already exists");
    }
    return serverError("server_error", error.message);
  }
  if (!data) return serverError("server_error", "Failed to update the subject");
  return json(data as SubjectRow, 200);
}
