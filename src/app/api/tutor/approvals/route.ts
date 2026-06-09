export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "@/lib/http";
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
    return json({ approved_subjects: [], approvals: [] }, 200);
  }
  const tutorId = (tutorRes.data as any).id;

  const approvals = await supabase
    .from("subject_approvals")
    .select("subject_name, subject_type, subject_grade, status")
    .eq("tutor_id", tutorId)
    .eq("status", "approved");

  const rows: any[] = approvals.data || [];
  const triples = rows
    .filter((a) => a.subject_name && a.subject_type && a.subject_grade)
    .map((a) => ({
      subject_name: a.subject_name,
      subject_type: a.subject_type,
      subject_grade: a.subject_grade,
    }));

  return json({ approved_subjects: triples, approvals: rows }, 200);
}
