import { json, serverError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ requestId: string }> }
) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.response;
  const { requestId } = await ctx.params;
  try {
    const supabase = a.supabase;

    // Identify admin for audit fields
    const { data: adminRow } = await supabase
      .from("admins")
      .select("id, school_id")
      .eq("auth_id", a.userId)
      .maybeSingle();
    if (!adminRow) {
      return json({ error: "Admin record not found" }, 403);
    }
    const adminId = (adminRow as any).id;
    const adminSchoolId = (adminRow as any).school_id;

    // Load request
    const { data: reqRow } = await supabase
      .from("certification_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();
    if (!reqRow) {
      return json({ error: "Request not found" }, 404);
    }
    const r = reqRow as any;

    // Scope check: if admin has a school, tutor must belong to it
    if (adminSchoolId) {
      const { data: tutorRow } = await supabase
        .from("tutors")
        .select("school_id")
        .eq("id", r.tutor_id)
        .maybeSingle();
      if (!tutorRow || (tutorRow as any).school_id !== adminSchoolId) {
        return json({ error: "not_in_admin_school_scope" }, 403);
      }
    }

    const subjectName = String(r.subject_name || "").trim();
    const subjectType = String(r.subject_type || "").trim();
    const subjectGrade = String(r.subject_grade ?? "").trim();
    const tutorId = r.tutor_id;

    if (!(tutorId && subjectName && subjectType && subjectGrade)) {
      return json({ error: "invalid_request_row" }, 400);
    }

    // Upsert approval as approved
    const nowIso = new Date().toISOString();
    const { data: existing } = await supabase
      .from("subject_approvals")
      .select("id")
      .eq("tutor_id", tutorId)
      .eq("subject_name", subjectName)
      .eq("subject_type", subjectType)
      .eq("subject_grade", subjectGrade)
      .limit(1);
    if (existing && existing.length > 0) {
      await supabase
        .from("subject_approvals")
        .update({
          status: "approved",
          approved_by: adminId,
          approved_at: nowIso,
        })
        .eq("tutor_id", tutorId)
        .eq("subject_name", subjectName)
        .eq("subject_type", subjectType)
        .eq("subject_grade", subjectGrade);
    } else {
      await supabase.from("subject_approvals").insert({
        tutor_id: tutorId,
        subject_name: subjectName,
        subject_type: subjectType,
        subject_grade: subjectGrade,
        status: "approved",
        approved_by: adminId,
        approved_at: nowIso,
      } as any);
    }

    // Delete certification request after approval
    await supabase
      .from("certification_requests")
      .delete()
      .eq("id", requestId);

    return json({ message: "Certification approved and request removed" }, 200);
  } catch (e) {
    console.error("Error approving certification request:", e);
    return serverError();
  }
}
