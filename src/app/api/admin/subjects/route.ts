import { requireAdmin } from "@/lib/auth";
import { badRequest } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { createSubjectSchema } from "@/lib/admin/schemas";
import { listOrgSubjects, createOrgSubject } from "@/lib/admin/subjects";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/subjects ?org_id&include=usage&q — an org's subject catalog by
 * `org_id` (REQUIRED, §6.4 / §7.2). The flat counterpart of the org-nested route,
 * sharing the same helpers. requireAdmin gates the route.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const url = new URL(req.url);
  const orgId = url.searchParams.get("org_id");
  if (!orgId) return badRequest("validation_error", "org_id is required");
  return listOrgSubjects(supabase, orgId, {
    includeUsage: url.searchParams.get("include") === "usage",
    q: (url.searchParams.get("q") || "").trim() || undefined,
  });
}

/**
 * POST /api/admin/subjects {org_id, name, category?, grade_level?} — add a subject
 * to an org catalog (§6.4 / §7.2). `org_id` is a REQUIRED body field here (the
 * flat variant). Duplicate triple → 409. The org_subjects_audit trigger records
 * the create. requireAdmin gates.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const parsed = await parseBody(req, createSubjectSchema);
  if (!parsed.ok) return parsed.response;
  return createOrgSubject(supabase, parsed.data.org_id, {
    name: parsed.data.name,
    category: parsed.data.category,
    grade_level: parsed.data.grade_level,
  });
}
