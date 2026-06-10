/**
 * Shared org-subject CRUD for the admin panel (§6.4) — used by BOTH the
 * org-nested routes (`/api/admin/orgs/[id]/subjects/*`) and the flat
 * `?org_id` routes (`/api/admin/subjects/*`). The admin's RLS-bound client sees
 * every org's catalog (`private.is_admin()`); the org_subjects_audit trigger
 * records create + active-toggle. A hard DELETE is attempted only while the
 * subject is unreferenced (sessions FK RESTRICT); a referenced delete
 * SOFT-DEACTIVATES instead (§6.4 "soft-deactivate when referenced").
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/types/database";
import { json, conflict, notFound, serverError } from "@/lib/http";
import type { CreateSubjectBody, PatchSubjectBody } from "@/lib/admin/schemas";

type SubjectRow = Database["public"]["Tables"]["org_subjects"]["Row"];
type SubjectUpdate = Database["public"]["Tables"]["org_subjects"]["Update"];

/** List an org's catalog with optional usage counts (open_sessions, approved_members). */
export async function listOrgSubjects(
  supabase: SupabaseClient<Database>,
  orgId: string,
  opts: { includeUsage?: boolean; q?: string } = {},
): Promise<NextResponse> {
  let query = supabase
    .from("org_subjects")
    .select("*")
    .eq("org_id", orgId)
    .order("name", { ascending: true })
    .order("category", { ascending: true, nullsFirst: true })
    .order("grade_level", { ascending: true, nullsFirst: true });
  if (opts.q) query = query.ilike("name", `%${opts.q.replace(/[%,()]/g, " ")}%`);

  const { data, error } = await query;
  if (error) return serverError("server_error", "Failed to load subjects");
  const rows = (data as SubjectRow[]) ?? [];

  if (!opts.includeUsage) {
    return json({ items: rows, total: rows.length, limit: rows.length, offset: 0 });
  }

  const [openSessions, approvedMembers] = await Promise.all([
    supabase.from("sessions").select("org_subject_id").eq("org_id", orgId).eq("status", "open"),
    supabase.from("subject_approvals").select("org_subject_id").eq("org_id", orgId).eq("status", "approved"),
  ]);
  if (openSessions.error || approvedMembers.error) {
    return serverError("server_error", "Failed to load subject usage");
  }
  const openBy = new Map<string, number>();
  for (const s of openSessions.data ?? []) openBy.set(s.org_subject_id, (openBy.get(s.org_subject_id) ?? 0) + 1);
  const approvedBy = new Map<string, number>();
  for (const a of approvedMembers.data ?? []) approvedBy.set(a.org_subject_id, (approvedBy.get(a.org_subject_id) ?? 0) + 1);

  const items = rows.map((r) => ({
    ...r,
    open_sessions: openBy.get(r.id) ?? 0,
    approved_members: approvedBy.get(r.id) ?? 0,
  }));
  return json({ items, total: items.length, limit: items.length, offset: 0 });
}

/** Create a subject in an org's catalog (triple unique per org → 409 on duplicate). */
export async function createOrgSubject(
  supabase: SupabaseClient<Database>,
  orgId: string,
  body: Omit<CreateSubjectBody, "org_id">,
): Promise<NextResponse> {
  // The org must exist (a cross-org insert into a missing org is impossible).
  const { data: org } = await supabase.from("organizations").select("id").eq("id", orgId).maybeSingle();
  if (!org) return notFound("not_found", "Organization not found");

  const { data, error } = await supabase
    .from("org_subjects")
    .insert({
      org_id: orgId,
      name: body.name,
      category: body.category ?? null,
      grade_level: body.grade_level ?? null,
      active: true,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return conflict("invalid_state", "That subject already exists in this catalog");
    return serverError("server_error", error.message);
  }
  if (!data) return serverError("server_error", "Failed to create the subject");
  return json(data as SubjectRow, 201);
}

/** Read a subject by id (no org scope; admin sees all). */
async function readSubject(supabase: SupabaseClient<Database>, id: string): Promise<SubjectRow | null> {
  const { data } = await supabase.from("org_subjects").select("*").eq("id", id).maybeSingle();
  return (data as SubjectRow) ?? null;
}

/** Patch a subject (rename/recategorize/regrade and/or toggle active). 409 on collision. */
export async function patchOrgSubject(
  supabase: SupabaseClient<Database>,
  id: string,
  body: PatchSubjectBody,
): Promise<NextResponse> {
  const before = await readSubject(supabase, id);
  if (!before) return notFound("not_found", "Subject not found");

  const patch: SubjectUpdate = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.category !== undefined) patch.category = body.category;
  if (body.grade_level !== undefined) patch.grade_level = body.grade_level;
  if (body.active !== undefined) patch.active = body.active;
  if (Object.keys(patch).length === 0) return json(before);

  const { data, error } = await supabase.from("org_subjects").update(patch).eq("id", id).select("*").maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return conflict("invalid_state", "Another subject with that name/category/grade already exists");
    }
    return serverError("server_error", error.message);
  }
  if (!data) return serverError("server_error", "Failed to update the subject");
  return json(data as SubjectRow);
}

/**
 * Delete a subject: hard-delete while UNREFERENCED; soft-deactivate (active=false)
 * when sessions reference it (the sessions FK is ON DELETE RESTRICT). Returns the
 * deactivated row (200) on the soft path, or 204 on a clean hard delete.
 */
export async function deleteOrgSubject(supabase: SupabaseClient<Database>, id: string): Promise<NextResponse> {
  const before = await readSubject(supabase, id);
  if (!before) return notFound("not_found", "Subject not found");

  const { count } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("org_subject_id", id);

  if ((count ?? 0) > 0) {
    // Referenced → soft-deactivate instead of a hard delete.
    if (!before.active) return json(before);
    const { data, error } = await supabase
      .from("org_subjects")
      .update({ active: false })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) return serverError("server_error", error.message);
    return json((data as SubjectRow) ?? before);
  }

  const { error } = await supabase.from("org_subjects").delete().eq("id", id);
  if (error) {
    // A RESTRICT we didn't anticipate (e.g. an approval) → fall back to soft.
    if (error.code === "23503") {
      const { data } = await supabase
        .from("org_subjects")
        .update({ active: false })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      return json((data as SubjectRow) ?? before);
    }
    return serverError("server_error", error.message);
  }
  return new Response(null, { status: 204 }) as unknown as NextResponse;
}
