import { requireActiveMember } from "@/lib/auth";
import { json, serverError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/member/subjects — the org's active subject catalog merged with the
 * caller's approval status per subject (§7.2). Powers the cascading request
 * pickers (§4.5) and the approval combobox (§4.8, "catalog minus approved/
 * pending"). Each item carries `my_approval_status` ∈ approval_status | null and
 * `can_request_approval` (true unless already pending/approved). RLS already
 * scopes both reads to the caller's org.
 */
export async function GET(req: Request) {
  const auth = await requireActiveMember(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth;

  const [subjects, approvals] = await Promise.all([
    supabase
      .from("org_subjects")
      .select("id, name, category, grade_level")
      .eq("org_id", orgId)
      .eq("active", true)
      .order("name", { ascending: true }),
    supabase
      .from("subject_approvals")
      .select("org_subject_id, status")
      .eq("profile_id", user.id),
  ]);

  if (subjects.error || approvals.error) {
    return serverError("server_error", "Failed to load subjects");
  }

  const bySubject = new Map<string, string>();
  for (const a of approvals.data ?? []) bySubject.set(a.org_subject_id, a.status);

  const items = (subjects.data ?? []).map((s) => {
    const myStatus = bySubject.get(s.id) ?? null;
    return {
      id: s.id,
      name: s.name,
      category: s.category,
      grade_level: s.grade_level,
      my_approval_status: myStatus,
      can_request_approval: myStatus !== "pending" && myStatus !== "approved",
    };
  });

  return json({ items });
}
