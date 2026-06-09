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
    return json({ jobs: [] }, 200);
  }
  const tutorId = (tutorRes.data as any).id;

  const res = await supabase
    .from("past_jobs")
    .select("*")
    .eq("tutor_id", tutorId)
    .order("created_at", { ascending: false });

  return json({ jobs: res.data || [] }, 200);
}
