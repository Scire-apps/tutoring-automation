export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json, notFound } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const tutorRes = await supabase
    .from("tutors")
    .select("*, school:schools(name,domain)")
    .eq("auth_id", auth.userId)
    .maybeSingle();
  if (!tutorRes.data) {
    return notFound("Tutor not found");
  }

  const resp = json({ tutor: tutorRes.data });
  resp.headers.set("Cache-Control", "private, max-age=10");
  return resp;
}
