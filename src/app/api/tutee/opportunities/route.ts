export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json, readJson } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/tutee/opportunities
 * Faithful port of Flask create_tutoring_opportunity.
 * Creates a new single-session tutoring opportunity request.
 * Requires subject_name/subject_type/subject_grade. Returns 201.
 */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const data = await readJson<Record<string, any>>(req);
  const required = ["subject_name", "subject_type", "subject_grade"];
  const missing = required.filter((f) => !(f in data));
  if (missing.length > 0) {
    return json({ error: `Missing required fields: ${missing.join(", ")}` }, 400);
  }

  const supabase = auth.supabase;

  // Find tutee by auth_id
  const tuteeResult = await supabase
    .from("tutees")
    .select("id, school_id")
    .eq("auth_id", auth.userId)
    .maybeSingle();

  if (!tuteeResult.data) {
    return json({ error: "Tutee profile not found" }, 404);
  }

  const tuteeId = (tuteeResult.data as any).id;

  const oppInsert = {
    tutee_id: tuteeId,
    subject_name: data.subject_name,
    subject_type: data.subject_type,
    subject_grade: String(data.subject_grade),
    language: data.language || "English",
    // Single-session flow: no availability at creation time
    availability: null,
    location_preference: data.location_preference ?? null,
    additional_notes: data.additional_notes ?? null,
    status: "open",
    priority: data.priority ?? "normal",
  };

  const result = await supabase
    .from("tutoring_opportunities")
    .insert(oppInsert as any)
    .select();

  if (!result.data || result.data.length === 0) {
    return json({ error: "Failed to create opportunity" }, 500);
  }

  return json({ message: "Opportunity created", opportunity: result.data[0] }, 201);
}
