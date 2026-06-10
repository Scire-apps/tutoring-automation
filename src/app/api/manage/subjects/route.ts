import { requireActiveManager } from "@/lib/auth";
import { json, conflict, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { createSubjectSchema } from "@/lib/manage/schemas";
import type { Database } from "@/types/database";

type SubjectRow = Database["public"]["Tables"]["org_subjects"]["Row"];

export const dynamic = "force-dynamic";

type SubjectDTO = SubjectRow & { open_sessions?: number; approved_members?: number };

/**
 * GET /api/manage/subjects ?include=usage — the org subject catalog (§5.11).
 * `?include=usage` annotates each row with open_sessions + approved_members
 * counts (the archive-warning Dialog needs them). org_id is server-derived; RLS
 * (`managed_org` via active_org SELECT) scopes the read to the org.
 */
export async function GET(req: Request) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const url = new URL(req.url);
  const includeUsage = url.searchParams.get("include") === "usage";

  const { data, error } = await supabase
    .from("org_subjects")
    .select("*")
    .eq("org_id", orgId)
    .order("name", { ascending: true })
    .order("category", { ascending: true, nullsFirst: true })
    .order("grade_level", { ascending: true, nullsFirst: true });

  if (error) return serverError("server_error", "Failed to load subjects");
  const rows = (data as SubjectRow[]) ?? [];

  if (!includeUsage) {
    return json({ items: rows as SubjectDTO[] });
  }

  // Per-subject usage: open sessions referencing it + approved members holding it.
  const [openSessions, approvedMembers] = await Promise.all([
    supabase.from("sessions").select("org_subject_id").eq("org_id", orgId).eq("status", "open"),
    supabase
      .from("subject_approvals")
      .select("org_subject_id")
      .eq("org_id", orgId)
      .eq("status", "approved"),
  ]);

  if (openSessions.error || approvedMembers.error) {
    return serverError("server_error", "Failed to load subject usage");
  }

  const openBySubject = new Map<string, number>();
  for (const s of openSessions.data ?? []) {
    openBySubject.set(s.org_subject_id, (openBySubject.get(s.org_subject_id) ?? 0) + 1);
  }
  const approvedBySubject = new Map<string, number>();
  for (const a of approvedMembers.data ?? []) {
    approvedBySubject.set(a.org_subject_id, (approvedBySubject.get(a.org_subject_id) ?? 0) + 1);
  }

  const items: SubjectDTO[] = rows.map((r) => ({
    ...r,
    open_sessions: openBySubject.get(r.id) ?? 0,
    approved_members: approvedBySubject.get(r.id) ?? 0,
  }));
  return json({ items });
}

/**
 * POST /api/manage/subjects — add a subject to the org catalog (§5.11). The
 * triple (name, category, grade_level) is unique per org (NULLS NOT DISTINCT) →
 * a duplicate is 409. The org_subjects_audit trigger records
 * `org.subject.created`. org_id is server-derived.
 */
export async function POST(req: Request) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;

  const parsed = await parseBody(req, createSubjectSchema);
  if (!parsed.ok) return parsed.response;
  const { name } = parsed.data;
  const category = parsed.data.category ?? null;
  const grade_level = parsed.data.grade_level ?? null;

  const { data, error } = await supabase
    .from("org_subjects")
    .insert({ org_id: orgId, name, category, grade_level, active: true })
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return conflict("invalid_state", "That subject already exists in your catalog");
    }
    return serverError("server_error", error.message);
  }
  if (!data) return serverError("server_error", "Failed to create the subject");
  return json(data as SubjectRow, 201);
}
