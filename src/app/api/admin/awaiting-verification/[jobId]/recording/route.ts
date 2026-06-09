import { json, serverError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.response;
  const { jobId } = await ctx.params;
  try {
    const { data: rec } = await a.supabase
      .from("session_recordings")
      .select("recording_url")
      .eq("job_id", jobId)
      .limit(1);
    const url =
      rec && rec.length > 0 ? (rec[0] as any).recording_url : null;
    return json({ recording_url: url }, 200);
  } catch (e) {
    console.error("Error fetching recording link:", e);
    return serverError();
  }
}
