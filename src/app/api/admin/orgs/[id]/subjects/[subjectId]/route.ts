import { requireAdmin } from "@/lib/auth";
import { parseBody } from "@/lib/validation";
import { patchSubjectSchema } from "@/lib/admin/schemas";
import { patchOrgSubject, deleteOrgSubject } from "@/lib/admin/subjects";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/orgs/[id]/subjects/[subjectId] — edit an org subject (§6.4):
 * rename / recategorize / regrade and/or toggle active. A triple collision → 409.
 * Shares the org-subject helpers with the flat routes. requireAdmin gates.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; subjectId: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { subjectId } = await ctx.params;

  const parsed = await parseBody(req, patchSubjectSchema);
  if (!parsed.ok) return parsed.response;
  return patchOrgSubject(supabase, subjectId, parsed.data);
}

/**
 * DELETE /api/admin/orgs/[id]/subjects/[subjectId] — remove an org subject (§6.4).
 * Hard-deletes while unreferenced; SOFT-DEACTIVATES (active=false) when sessions
 * reference it (FK RESTRICT). 204 on hard delete; the deactivated row on the soft
 * path. requireAdmin gates.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string; subjectId: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { subjectId } = await ctx.params;
  return deleteOrgSubject(supabase, subjectId);
}
