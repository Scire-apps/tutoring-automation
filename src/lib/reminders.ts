/**
 * Session reminder job, ported from the Flask `reminder_service`.
 * Sends "session tomorrow" emails to tutor + tutee for all `scheduled` jobs
 * whose `scheduled_time` falls in tomorrow's window. Invoked by the cron route
 * with a service-role client (no user context).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { sendTutorReminder, sendTuteeReminder, type ReminderDetails } from "@/lib/email";

function tomorrowRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function sendSessionReminders(supabase: SupabaseClient<Database>): Promise<number> {
  const { start, end } = tomorrowRange();

  const { data: sessions, error } = await supabase
    .from("tutoring_jobs")
    .select("*")
    .eq("status", "scheduled")
    .gte("scheduled_time", start)
    .lte("scheduled_time", end);

  if (error || !sessions || sessions.length === 0) return 0;

  let count = 0;
  for (const session of sessions) {
    try {
      let tutor: { first_name?: string | null; last_name?: string | null; email?: string | null } = {};
      try {
        const { data } = await supabase
          .from("tutors")
          .select("first_name,last_name,email")
          .eq("id", session.tutor_id)
          .single();
        tutor = data || {};
      } catch {
        tutor = {};
      }

      const snapshot =
        session.opportunity_snapshot && typeof session.opportunity_snapshot === "object"
          ? (session.opportunity_snapshot as Record<string, unknown>)
          : {};

      const scheduled = session.scheduled_time ? new Date(session.scheduled_time) : null;
      const formattedDate = scheduled
        ? scheduled.toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" })
        : "";
      const formattedTime = scheduled
        ? scheduled.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
        : "";

      const details: ReminderDetails = {
        subject: String(snapshot.subject ?? session.subject_name ?? ""),
        date: formattedDate,
        time: formattedTime,
        location: String(snapshot.session_location ?? session.location ?? ""),
        tutor_name: `${tutor.first_name ?? ""} ${tutor.last_name ?? ""}`.trim(),
        tutee_name: `${snapshot.tutee_first_name ?? ""} ${snapshot.tutee_last_name ?? ""}`.trim(),
      };

      const tuteeEmail = String(snapshot.tutee_email ?? "");
      const tutorOk = await sendTutorReminder(tutor.email ?? "", details);
      const tuteeOk = await sendTuteeReminder(tuteeEmail, details);

      if (tutorOk && tuteeOk) count += 1;
    } catch {
      continue;
    }
  }
  return count;
}
