import { requireAdmin } from "@/lib/auth";
import { parseBody } from "@/lib/validation";
import { patchSubjectSchema } from "@/lib/admin/schemas";
import { patchOrgSubject, deleteOrgSubject } from "@/lib/admin/subjects";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/subjects/[id] — edit an org subject (§6.4 / §7.2): rename /
 * recategorize / regrade and/or toggle active. Triple collision → 409. The flat
 * counterpart of the org-nested route. requireAdmin gates.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, patchSubjectSchema);
  if (!parsed.ok) return parsed.response;
  return patchOrgSubject(supabase, id, parsed.data);
}

/**
 * DELETE /api/admin/subjects/[id] — remove an org subject (§6.4 / §7.2).
 * Hard-deletes while unreferenced; SOFT-DEACTIVATES when sessions reference it.
 * 204 on hard delete; the deactivated row on the soft path. requireAdmin gates.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await ctx.params;
  return deleteOrgSubject(supabase, id);
}
