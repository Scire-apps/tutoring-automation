import { json, serverError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.response;
  try {
    const supabase = a.supabase;

    // Admin profile
    const { data: adminPayload } = await supabase
      .from("admins")
      .select(
        "id, auth_id, email, first_name, last_name, role, school_id, school:schools(name,domain)"
      )
      .eq("auth_id", a.userId)
      .maybeSingle();
    const schoolId = adminPayload ? (adminPayload as any).school_id : null;

    // Tutors (scoped if school assigned)
    let tutorsQ = supabase
      .from("tutors")
      .select(
        "id, first_name, last_name, email, school_id, status, volunteer_hours, created_at, school:schools(name,domain)"
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (schoolId) {
      tutorsQ = tutorsQ.eq("school_id", schoolId);
    }
    const { data: tutorsData } = await tutorsQ;

    // Opportunities (scoped by admin's tutees when school assigned)
    let tuteeIds: string[] | null = null;
    if (schoolId) {
      const { data: tutees } = await supabase
        .from("tutees")
        .select("id")
        .eq("school_id", schoolId);
      tuteeIds = (tutees || []).map((t: any) => t.id);
    }
    let oppQ = supabase
      .from("tutoring_opportunities")
      .select(
        "id, tutee_id, subject_name, subject_type, subject_grade, language, status, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (tuteeIds && tuteeIds.length > 0) {
      oppQ = oppQ.in("tutee_id", tuteeIds);
    }
    const { data: oppData } = await oppQ;

    // Awaiting verification jobs
    const { data: awaitingData } = await supabase
      .from("awaiting_verification_jobs")
      .select(
        "id, tutor_id, tutee_id, tutor_name, tutee_name, subject_name, subject_type, subject_grade, language, scheduled_time, duration_minutes, created_at, opportunity_snapshot"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    // Help requests (scoped by school if present)
    let helpQ = supabase
      .from("help_questions")
      .select(
        "id, auth_id, role, tutor_id, tutee_id, school_id, user_first_name, user_last_name, user_email, user_grade, submitted_at, urgency, description"
      )
      .order("submitted_at", { ascending: false })
      .limit(100);
    if (schoolId) {
      helpQ = helpQ.eq("school_id", schoolId);
    }
    const { data: helpData } = await helpQ;

    // Certification requests (scoped by school if present)
    let certData: any[] = [];
    if (schoolId) {
      const { data: tutorsIds } = await supabase
        .from("tutors")
        .select("id")
        .eq("school_id", schoolId);
      const tutorIds = (tutorsIds || []).map((t: any) => t.id);
      if (tutorIds.length > 0) {
        const { data } = await supabase
          .from("certification_requests")
          .select(
            "id, tutor_id, tutor_name, tutor_mark, subject_name, subject_type, subject_grade, created_at"
          )
          .in("tutor_id", tutorIds)
          .order("created_at", { ascending: false })
          .limit(200);
        certData = data || [];
      } else {
        certData = [];
      }
    } else {
      const { data } = await supabase
        .from("certification_requests")
        .select(
          "id, tutor_id, tutor_name, tutor_mark, subject_name, subject_type, subject_grade, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(200);
      certData = data || [];
    }

    // Schools (admin needs for filters)
    const { data: schoolsData } = await supabase
      .from("schools")
      .select("id, name, domain")
      .order("name");

    const payload = {
      admin: adminPayload || null,
      tutors: tutorsData || [],
      opportunities: oppData || [],
      awaiting_jobs: awaitingData || [],
      help_requests: helpData || [],
      certification_requests: certData || [],
      schools: schoolsData || [],
    };

    return json(payload, 200);
  } catch (e) {
    console.error("Error building admin overview:", e);
    return serverError();
  }
}
