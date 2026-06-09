import { json, readJson } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import {
  isValidIso,
  isValidScheduleDuration,
  durationMismatchesDesired,
  timeFitsAvailability,
  deriveDateAndStart,
} from "@/lib/domain";
import { sendSessionConfirmation, sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Mirror Python strftime '%A, %B %d, %Y' for a local Date. */
function formatLongDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${day}, ${d.getFullYear()}`;
}

/** Mirror Python strftime '%I:%M %p' for a local Date. */
function formatTime12(d: Date): string {
  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm} ${ampm}`;
}

/** Format from an ISO timestamp (UTC-based, mirrors fromisoformat + strftime). */
function formatFromIso(iso: string): { date: string; time: string } {
  const d = new Date(iso.replace("Z", "+00:00"));
  // Use UTC components so we don't shift by the server's local timezone.
  const day = String(d.getUTCDate()).padStart(2, "0");
  const date = `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${day}, ${d.getUTCFullYear()}`;
  let hours = d.getUTCHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const time = `${String(hours).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} ${ampm}`;
  return { date, time };
}

/**
 * POST /api/tutor/jobs/[jobId]/schedule
 * Faithful port of tutor.py schedule_job.
 *
 * Body: { scheduled_time: ISO8601, duration_minutes: 60..180,
 *         date|date_key?, start_time|start_hhmm? }
 * Sets status to 'scheduled'.
 */
export async function POST(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const payload = await readJson<Record<string, any>>(req);
  const scheduledTime = payload.scheduled_time;
  let durationMinutes = payload.duration_minutes;
  const explicitDateKey = payload.date || payload.date_key;
  const explicitStartHHMM = payload.start_time || payload.start_hhmm;

  if (!scheduledTime) {
    return json({ error: "scheduled_time is required" }, 400);
  }
  if (typeof scheduledTime !== "string" || !isValidIso(scheduledTime)) {
    return json({ error: "scheduled_time must be ISO8601" }, 400);
  }

  // Coerce duration to int (mirrors Flask int())
  const durNum = Number(durationMinutes);
  if (!Number.isInteger(durNum)) {
    return json({ error: "duration_minutes must be an integer" }, 400);
  }
  durationMinutes = durNum;
  if (!isValidScheduleDuration(durationMinutes)) {
    return json({ error: "duration_minutes must be between 60 and 180" }, 400);
  }

  const tutorRes = await supabase
    .from("tutors")
    .select("id")
    .eq("auth_id", auth.userId)
    .maybeSingle();
  if (!tutorRes.data) {
    return json({ error: "Tutor not found" }, 404);
  }
  const tutorId = tutorRes.data.id;

  // Ensure job belongs to tutor
  const jobRes = await supabase
    .from("tutoring_jobs")
    .select("id, opportunity_id")
    .eq("id", jobId)
    .eq("tutor_id", tutorId)
    .maybeSingle();
  if (!jobRes.data) {
    return json({ error: "Job not found" }, 404);
  }

  // Fetch tutee_availability + desired_duration for validation
  const jobDetail = await supabase
    .from("tutoring_jobs")
    .select("tutee_availability, desired_duration_minutes")
    .eq("id", jobId)
    .maybeSingle();
  if (jobDetail.data) {
    const desired = jobDetail.data.desired_duration_minutes;
    if (durationMismatchesDesired(durationMinutes, desired)) {
      return json({ error: "duration_mismatch_with_tutee_preference" }, 400);
    }
  }
  if (
    jobDetail.data &&
    jobDetail.data.tutee_availability &&
    typeof jobDetail.data.tutee_availability === "object" &&
    !Array.isArray(jobDetail.data.tutee_availability)
  ) {
    try {
      const availability = jobDetail.data.tutee_availability as Record<string, unknown>;
      let dateKey: string;
      let startHHMM: string;
      if (typeof explicitDateKey === "string" && typeof explicitStartHHMM === "string") {
        dateKey = explicitDateKey;
        startHHMM = explicitStartHHMM;
      } else {
        const derived = deriveDateAndStart(scheduledTime);
        dateKey = derived.dateKey;
        startHHMM = derived.startHHMM;
      }

      const ranges = availability[dateKey];
      // Only enforce if availability exists for this exact date
      if (Array.isArray(ranges) && ranges.length > 0) {
        if (!timeFitsAvailability(availability, dateKey, startHHMM, durationMinutes)) {
          return json({ error: "chosen_time_not_in_tutee_availability" }, 400);
        }
      }
    } catch {
      // ignore, mirrors Flask's broad except: pass
    }
  }

  const updates = {
    status: "scheduled",
    scheduled_time: scheduledTime,
    duration_minutes: durationMinutes,
  };
  const upd = await supabase.from("tutoring_jobs").update(updates).eq("id", jobId).select();
  if (!upd.data || upd.data.length === 0) {
    return json({ error: "Failed to update job" }, 500);
  }

  // Prepare and send session confirmation email(s) without nested selects (best-effort)
  try {
    let jobRow: any = null;
    try {
      const r = await supabase.from("tutoring_jobs").select("*").eq("id", jobId).maybeSingle();
      jobRow = r.data;
    } catch {
      jobRow = null;
    }
    let tutorRow: any = null;
    try {
      const r = await supabase
        .from("tutors")
        .select("email, first_name, last_name")
        .eq("auth_id", auth.userId)
        .maybeSingle();
      tutorRow = r.data;
    } catch {
      tutorRow = null;
    }
    let tuteeRow: any = null;
    try {
      if (jobRow && jobRow.tutee_id) {
        const r = await supabase
          .from("tutees")
          .select("email, first_name, last_name, grade")
          .eq("id", jobRow.tutee_id)
          .maybeSingle();
        tuteeRow = r.data;
      }
    } catch {
      tuteeRow = null;
    }

    if (tutorRow && jobRow) {
      const tutorName = `${tutorRow.first_name || ""} ${tutorRow.last_name || ""}`.trim();
      let tuteeName: string | null = null;
      let tuteeEmail: string | null = null;
      let tuteeGrade: string | null = null;
      if (tuteeRow) {
        tuteeName = `${tuteeRow.first_name || ""} ${tuteeRow.last_name || ""}`.trim();
        tuteeEmail = tuteeRow.email;
        tuteeGrade = tuteeRow.grade ?? null;
      }

      let formattedDate: string;
      let formattedTime: string;
      try {
        if (typeof explicitDateKey === "string" && typeof explicitStartHHMM === "string") {
          try {
            const [y, m, d] = explicitDateKey.split("-").map((x: string) => parseInt(x, 10));
            const [sh, sm] = explicitStartHHMM.split(":").map((x: string) => parseInt(x, 10));
            if ([y, m, d, sh, sm].some((n) => Number.isNaN(n))) throw new Error("parse");
            const localDt = new Date(y, m - 1, d, sh, sm);
            formattedDate = formatLongDate(localDt);
            formattedTime = formatTime12(localDt);
          } catch {
            const f = formatFromIso(scheduledTime);
            formattedDate = f.date;
            formattedTime = f.time;
          }
        } else {
          const f = formatFromIso(scheduledTime);
          formattedDate = f.date;
          formattedTime = f.time;
        }
      } catch {
        formattedDate = "Scheduled Date";
        formattedTime = "Scheduled Time";
      }

      const subjectString = `${jobRow.subject_name || ""} • ${jobRow.subject_type || ""} • Grade ${jobRow.subject_grade || ""}`.trim();
      const location = jobRow.location || "Location TBD";

      if (tutorRow.email && tuteeEmail) {
        await sendSessionConfirmation(tutorRow.email, tuteeEmail, {
          subject: subjectString,
          date: formattedDate,
          time: formattedTime,
          location,
          tutor_name: tutorName,
          tutee_name: tuteeName || "Student",
          tutee_grade: tuteeGrade,
          duration_minutes: durationMinutes,
        });
      } else if (tutorRow.email) {
        const subj = `Session Confirmation: ${subjectString} on ${formattedDate}`;
        const html = `
            <html><body>
            <h2>Session Confirmation</h2>
            <p>Hello ${tutorName},</p>
            <p>Your session has been scheduled for <strong>${subjectString}</strong> on <strong>${formattedDate}</strong> at <strong>${formattedTime}</strong> at <strong>${location}</strong>.</p>
            </body></html>
            `;
        const text = `Session Confirmation for ${subjectString} on ${formattedDate} at ${formattedTime} (${location})`;
        await sendEmail({ to: tutorRow.email, subject: subj, html, text });
      }
    }
  } catch {
    // Email side-effects are best-effort and must never change the response.
  }

  return json({ message: "Scheduled", job: upd.data[0] }, 200);
}
