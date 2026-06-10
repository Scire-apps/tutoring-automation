import { after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { json, badRequest, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { logAudit } from "@/lib/log";
import { patchTemplateSchema } from "@/lib/admin/schemas";
import { toAdminTemplateDTO } from "@/lib/admin/dtos";
import type { Database } from "@/types/database";

type TemplateRow = Database["public"]["Tables"]["subject_templates"]["Row"];
type TemplateUpdate = Database["public"]["Tables"]["subject_templates"]["Update"];

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/subject-template/[id] {name?, category?, grade_level?} — edit a
 * default template row (§6.4). A triple collision → 409. Affects NEW orgs only.
 * subject_templates has no audit trigger → an explicit `template.updated` row.
 * requireAdmin gates.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, patchTemplateSchema);
  if (!parsed.ok) return parsed.response;

  const { data: before } = await supabase.from("subject_templates").select("id").eq("id", id).maybeSingle();
  if (!before) return notFound("not_found", "Template subject not found");

  const patch: TemplateUpdate = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.category !== undefined) patch.category = parsed.data.category;
  if (parsed.data.grade_level !== undefined) patch.grade_level = parsed.data.grade_level;
  if (Object.keys(patch).length === 0) return badRequest("validation_error", "No changes provided");

  const { data, error } = await supabase
    .from("subject_templates")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return conflict("invalid_state", "That template subject already exists");
    return serverError("server_error", error.message);
  }
  if (!data) return serverError("server_error", "Failed to update the template subject");

  const row = data as TemplateRow;
  after(() =>
    logAudit({
      action: "template.updated",
      actor_id: user.id,
      actor_kind: "admin",
      target_table: "subject_templates",
      target_id: row.id,
      metadata: { name: row.name, category: row.category, grade_level: row.grade_level },
    }),
  );

  return json(toAdminTemplateDTO(row));
}

/**
 * DELETE /api/admin/subject-template/[id] — remove a default template row (§6.4).
 * Templates are reference data with no FK references (org_subjects are COPIES, not
 * FK-linked), so a hard delete is always safe. Affects NEW orgs only. An explicit
 * `template.deleted` audit row is written. requireAdmin gates.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  const { data: before } = await supabase
    .from("subject_templates")
    .select("id, name, category, grade_level")
    .eq("id", id)
    .maybeSingle();
  if (!before) return notFound("not_found", "Template subject not found");

  const { error } = await supabase.from("subject_templates").delete().eq("id", id);
  if (error) return serverError("server_error", error.message);

  after(() =>
    logAudit({
      action: "template.deleted",
      actor_id: user.id,
      actor_kind: "admin",
      target_table: "subject_templates",
      target_id: id,
      metadata: { name: before.name, category: before.category, grade_level: before.grade_level },
    }),
  );

  return new Response(null, { status: 204 });
}
