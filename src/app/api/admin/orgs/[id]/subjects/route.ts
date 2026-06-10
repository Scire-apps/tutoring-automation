import { requireAdmin } from "@/lib/auth";
import { parseBody } from "@/lib/validation";
import { createSubjectSchema } from "@/lib/admin/schemas";
import { listOrgSubjects, createOrgSubject } from "@/lib/admin/subjects";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/orgs/[id]/subjects ?include=usage&q — an org's subject catalog
 * (§6.4). `?include=usage` annotates each row with open_sessions + approved_members.
 * Cross-org admin read; shares the org-subject helpers with the flat `?org_id`
 * routes. requireAdmin gates the route.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await ctx.params;
  const url = new URL(req.url);
  return listOrgSubjects(supabase, id, {
    includeUsage: url.searchParams.get("include") === "usage",
    q: (url.searchParams.get("q") || "").trim() || undefined,
  });
}

/**
 * POST /api/admin/orgs/[id]/subjects {name, category?, grade_level?} — add a
 * subject to an org's catalog (§6.4). The triple is unique per org → duplicate is
 * 409. The body's org_id (if present) is IGNORED; the path id wins. The
 * org_subjects_audit trigger records `org.subject.created`.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await ctx.params;

  // Reuse the create schema but inject the path org_id (body org_id is optional here).
  const parsed = await parseBody(req, createSubjectSchema.partial({ org_id: true }));
  if (!parsed.ok) return parsed.response;
  return createOrgSubject(supabase, id, {
    name: parsed.data.name,
    category: parsed.data.category,
    grade_level: parsed.data.grade_level,
  });
}
