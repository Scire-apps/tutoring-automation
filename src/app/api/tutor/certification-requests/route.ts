export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json, badRequest, notFound, serverError, readJson } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const tutorRes = await supabase
    .from("tutors")
    .select("id")
    .eq("auth_id", auth.userId)
    .maybeSingle();
  if (!tutorRes.data) {
    return json({ requests: [] }, 200);
  }
  const tutorId = (tutorRes.data as any).id;

  const res = await supabase
    .from("certification_requests")
    .select("*")
    .eq("tutor_id", tutorId)
    .order("created_at", { ascending: false });

  return json({ requests: res.data || [] }, 200);
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const payload = await readJson<Record<string, any>>(req);

  const subjectName = String(payload.subject_name || "").trim();
  const subjectType = String(payload.subject_type || "").trim();
  const subjectGrade = String(payload.subject_grade || "").trim();
  const tutorMark = String(payload.tutor_mark || "").trim();

  if (
    !subjectName ||
    !["Academic", "ALP", "IB"].includes(subjectType) ||
    !["9", "10", "11", "12"].includes(subjectGrade)
  ) {
    return badRequest(
      "invalid_input",
      "Provide subject_name, valid subject_type, subject_grade"
    );
  }

  // Identify tutor
  const tutorRes = await supabase
    .from("tutors")
    .select("id, first_name, last_name")
    .eq("auth_id", auth.userId)
    .maybeSingle();
  if (!tutorRes.data) {
    return notFound("Tutor profile not found");
  }

  const tutorRow: any = tutorRes.data;
  const tutorId = tutorRow.id;
  const tutorName = `${String(tutorRow.first_name || "").trim()} ${String(
    tutorRow.last_name || ""
  ).trim()}`.trim();

  const ins = await supabase
    .from("certification_requests")
    .insert({
      tutor_id: tutorId,
      tutor_name: tutorName || null,
      subject_name: subjectName,
      subject_type: subjectType,
      subject_grade: subjectGrade,
      tutor_mark: tutorMark || null,
    } as any)
    .select();

  if (!ins.data || ins.data.length === 0) {
    return serverError("failed_to_create");
  }

  return json(
    { message: "Certification request submitted", request: ins.data[0] },
    201
  );
}
