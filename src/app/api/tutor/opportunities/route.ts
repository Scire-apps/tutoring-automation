export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  try {
    const tutorRes = await supabase
      .from("tutors")
      .select("status")
      .eq("auth_id", auth.userId)
      .maybeSingle();

    const res = await supabase
      .from("tutoring_opportunities")
      .select("*, tutee:tutees(id, first_name, last_name, email, school_id, grade)")
      .eq("status", "open")
      .order("created_at")
      .limit(100);
    if (res.error) throw res.error;

    const payload = {
      opportunities: res.data || [],
      tutor_status: (tutorRes.data as any)?.status ?? null,
    };

    const resp = json(payload, 200);
    resp.headers.set("Cache-Control", "private, max-age=10");
    return resp;
  } catch (e: any) {
    return json(
      { error: "failed_to_list_opportunities", details: String(e?.message ?? e) },
      500
    );
  }
}
