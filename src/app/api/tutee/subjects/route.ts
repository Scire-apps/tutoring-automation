export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json, readJson } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { SUBJECTS } from "@/lib/subjects";

/**
 * GET /api/tutee/subjects
 * Faithful port of Flask get_tutee_subjects.
 * Returns the tutee profile subjects and the master subjects list.
 * The master list (was subjects.txt) is provided by SUBJECTS, capitalized to
 * match the display/stored values exactly as the Flask code did.
 */
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const tuteeRes = await supabase
    .from("tutees")
    .select("id, subjects")
    .eq("auth_id", auth.userId)
    .maybeSingle();

  const subjects = tuteeRes && tuteeRes.data ? (tuteeRes.data as any).subjects : [];

  // Master list (replacement for subjects.txt). Capitalize first letter.
  const masterCap = SUBJECTS.map((n) => (n ? n[0].toUpperCase() + n.slice(1) : n));

  return json({ subjects: subjects || [], all_subjects: masterCap }, 200);
}

/**
 * PUT /api/tutee/subjects
 * Faithful port of Flask update_tutee_subjects.
 * Updates tutee.subjects (array). Body: { subjects: string[] }
 */
export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const body = await readJson<Record<string, any>>(req);
  const subs = body.subjects;
  if (!Array.isArray(subs)) {
    return json({ error: "subjects must be an array" }, 400);
  }

  const tuteeRes = await supabase
    .from("tutees")
    .select("id")
    .eq("auth_id", auth.userId)
    .maybeSingle();

  if (!tuteeRes.data) {
    return json({ error: "Tutee not found" }, 404);
  }

  const upd = await supabase
    .from("tutees")
    .update({ subjects: subs } as any)
    .eq("id", (tuteeRes.data as any).id)
    .select();

  if (!upd.data || upd.data.length === 0) {
    return json({ error: "Failed to update subjects" }, 500);
  }

  return json({ message: "Subjects updated", tutee: upd.data[0] }, 200);
}
