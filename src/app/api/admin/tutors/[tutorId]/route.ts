import { json, serverError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ tutorId: string }> }
) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.response;
  const { tutorId } = await ctx.params;
  try {
    const { data: tutor } = await a.supabase
      .from("tutors")
      .select(
        "id, first_name, last_name, email, status, volunteer_hours, school_id, school:schools(name, domain)"
      )
      .eq("id", tutorId)
      .maybeSingle();

    if (!tutor) {
      return json({ error: "Tutor not found" }, 404);
    }

    const { data: approvals } = await a.supabase
      .from("subject_approvals")
      .select("id, subject_name, subject_type, subject_grade, status, approved_at")
      .eq("tutor_id", tutorId)
      .order("approved_at", { ascending: false })
      .limit(200);

    return json(
      {
        tutor,
        approved_subject_ids: [],
        available_subjects: [],
        subject_approvals: approvals || [],
      },
      200
    );
  } catch (e) {
    console.error("Error getting tutor details:", e);
    return serverError();
  }
}
