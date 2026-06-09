import { json, readJson, serverError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.response;
  const { jobId } = await ctx.params;
  try {
    const supabase = a.supabase;
    const data = await readJson<Record<string, any>>(req);
    const awardedHours = Number(data.awarded_hours || 0);
    if (awardedHours < 0) {
      return json({ error: "awarded_hours must be non-negative" }, 400);
    }

    // Load awaiting job
    const { data: aw } = await supabase
      .from("awaiting_verification_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    if (!aw) {
      return json({ error: "Awaiting verification job not found" }, 404);
    }
    const awData = aw as any;

    // Identify admin
    const { data: adminRes } = await supabase
      .from("admins")
      .select("id")
      .eq("auth_id", a.userId)
      .maybeSingle();
    if (!adminRes) {
      return json({ error: "Admin not found" }, 403);
    }

    // Move to past_jobs
    const now = new Date().toISOString();
    const snapshot =
      awData.opportunity_snapshot &&
      typeof awData.opportunity_snapshot === "object"
        ? awData.opportunity_snapshot
        : {};
    const pjRow = {
      id: awData.id,
      opportunity_id: awData.opportunity_id ?? null,
      tutor_id: awData.tutor_id ?? null,
      tutee_id: awData.tutee_id ?? null,
      subject_name: awData.subject_name ?? null,
      subject_type: awData.subject_type ?? null,
      subject_grade: awData.subject_grade ?? null,
      language: awData.language || snapshot.language || "English",
      tutee_availability: awData.tutee_availability ?? null,
      desired_duration_minutes: awData.desired_duration_minutes ?? null,
      scheduled_time: awData.scheduled_time ?? null,
      duration_minutes: awData.duration_minutes ?? null,
      opportunity_snapshot: awData.opportunity_snapshot ?? null,
      location: awData.location ?? null,
      verified_by: (adminRes as any).id,
      verified_at: now,
      awarded_volunteer_hours: awardedHours,
    };
    const { data: ins } = await supabase
      .from("past_jobs")
      .insert(pjRow as any)
      .select();
    if (!ins || ins.length === 0) {
      return json({ error: "failed_to_archive_job" }, 500);
    }

    // Update tutor hours
    try {
      const tutorId = awData.tutor_id;
      if (tutorId && awardedHours) {
        const { data: tutor } = await supabase
          .from("tutors")
          .select("volunteer_hours")
          .eq("id", tutorId)
          .maybeSingle();
        const current = Number((tutor as any)?.volunteer_hours || 0);
        await supabase
          .from("tutors")
          .update({ volunteer_hours: current + Number(awardedHours) })
          .eq("id", tutorId);
      }
    } catch {
      // best-effort
    }

    // Remove communications and awaiting row
    await supabase.from("communications").delete().eq("job_id", jobId);
    await supabase
      .from("awaiting_verification_jobs")
      .delete()
      .eq("id", jobId);

    return json({ message: "Job verified and archived" }, 200);
  } catch (e) {
    console.error("Error verifying job:", e);
    return serverError();
  }
}
