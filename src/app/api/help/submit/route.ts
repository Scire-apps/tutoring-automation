import { json, readJson } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/help/submit
 * Insert a new help request for the authenticated user.
 * Body: { urgency: 'urgent'|'non-urgent', description: string }
 * Maps urgency -> 'high'|'normal'. Derives role/profile from tutors/tutees.
 */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const body = await readJson<Record<string, unknown>>(req);
  const urgencyRaw = String(body.urgency ?? "").trim().toLowerCase();
  const description = String(body.description ?? "").trim();
  if (!description) {
    return json({ error: "description_required" }, 400);
  }

  const urgency = urgencyRaw === "urgent" ? "high" : "normal";

  // Determine role and profile (prefer tutor, then tutee)
  let role: "tutor" | "tutee" | null = null;
  let tutorRow: any = null;
  let tuteeRow: any = null;

  try {
    const { data } = await supabase
      .from("tutors")
      .select("id, first_name, last_name, email, school_id")
      .eq("auth_id", auth.userId)
      .maybeSingle();
    tutorRow = data;
    if (tutorRow) {
      role = "tutor";
    }
  } catch {
    tutorRow = null;
  }

  if (role === null) {
    try {
      const { data } = await supabase
        .from("tutees")
        .select("id, first_name, last_name, email, school_id, grade")
        .eq("auth_id", auth.userId)
        .maybeSingle();
      tuteeRow = data;
      if (tuteeRow) {
        role = "tutee";
      }
    } catch {
      tuteeRow = null;
    }
  }

  if (role === null) {
    return json({ error: "profile_not_found" }, 404);
  }

  let firstName: string | null;
  let lastName: string | null;
  let email: string | null;
  let schoolId: string | null;
  let userGrade: string | null;
  let tutorId: string | null;
  let tuteeId: string | null;

  if (role === "tutor") {
    firstName = tutorRow.first_name ?? null;
    lastName = tutorRow.last_name ?? null;
    email = tutorRow.email ?? null;
    schoolId = tutorRow.school_id ?? null;
    userGrade = null;
    tutorId = tutorRow.id ?? null;
    tuteeId = null;
  } else {
    firstName = tuteeRow.first_name ?? null;
    lastName = tuteeRow.last_name ?? null;
    email = tuteeRow.email ?? null;
    schoolId = tuteeRow.school_id ?? null;
    userGrade = tuteeRow.grade ?? null;
    tutorId = null;
    tuteeId = tuteeRow.id ?? null;
  }

  const payload = {
    auth_id: auth.userId,
    role,
    tutor_id: tutorId,
    tutee_id: tuteeId,
    school_id: schoolId,
    user_first_name: firstName || "",
    user_last_name: lastName || "",
    user_email: email || auth.email || "",
    user_grade: userGrade,
    urgency,
    description,
  };

  const { data: insData } = await supabase
    .from("help_questions")
    .insert(payload)
    .select();

  if (!insData || insData.length === 0) {
    return json({ error: "failed_to_submit" }, 500);
  }
  return json({ message: "submitted", help: insData[0] }, 201);
}
