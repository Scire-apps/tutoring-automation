/**
 * Org-aware session-reminder pass (§7.8). Finds sessions scheduled for the
 * UPCOMING day (tomorrow in UTC) that are still `scheduled`, and emails both the
 * tutor and the requester a "session tomorrow" reminder.
 *
 * IDEMPOTENCY / retry-safety: the schema carries no `reminder_sent_at` column,
 * so the append-only `email_log` is the sent-marker — a session that already has
 * a `session_reminder` row is skipped on subsequent runs. Because every send
 * self-logs to email_log (via lib/email → lib/log), the marker is written
 * atomically with delivery; a re-invoked cron never double-sends.
 *
 * Runs under the service-role client (no user context, cross-org read) passed in
 * by the cron route. Joins requester/claimer/subject/org in one read (no N+1).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { sessionReminder, type ReminderDetails } from "@/lib/email";

/** [start, end) UTC bounds for "tomorrow" relative to `now`. */
function tomorrowUtcWindow(now: Date): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2, 0, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Format an ISO instant into a human date (UTC) for the email body. */
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Format an ISO instant into HH:MM (UTC). */
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

type ReminderRow = {
  id: string;
  org_id: string;
  scheduled_at: string | null;
  location: string | null;
  location_preference: Database["public"]["Enums"]["location_preference"];
  requester: { id: string; email: string; first_name: string } | null;
  tutor: { id: string; email: string; first_name: string } | null;
  subject: { name: string } | null;
};

/**
 * Send reminders for all sessions scheduled tomorrow. Returns the number of
 * sessions for which at least one reminder was dispatched (a session counts once
 * even though both parties are emailed). Best-effort per session — one failure
 * never aborts the batch.
 */
export async function sendSessionReminders(
  supabase: SupabaseClient<Database>,
): Promise<number> {
  const { start, end } = tomorrowUtcWindow(new Date());

  // One read: tomorrow's scheduled sessions with both parties + subject joined.
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select(
      `id, org_id, scheduled_at, location, location_preference,
       requester:profiles!sessions_requester_fk ( id, email, first_name ),
       tutor:profiles!sessions_tutor_fk ( id, email, first_name ),
       subject:org_subjects!sessions_subject_fk ( name )`,
    )
    .eq("status", "scheduled")
    .gte("scheduled_at", start)
    .lt("scheduled_at", end);

  if (error) {
    console.error("[reminders] failed to load scheduled sessions:", error.message);
    return 0;
  }

  const rows = (sessions as unknown as ReminderRow[]) ?? [];
  if (rows.length === 0) return 0;

  // Idempotency: which of these sessions already have a SUCCESSFUL reminder
  // logged? Only `status='sent'` rows count as the marker, so a transient send
  // failure is retried on the next run rather than silently skipped forever.
  const ids = rows.map((r) => r.id);
  const { data: sent } = await supabase
    .from("email_log")
    .select("session_id")
    .eq("kind", "session_reminder")
    .eq("status", "sent")
    .in("session_id", ids);
  const alreadySent = new Set((sent ?? []).map((r) => r.session_id).filter(Boolean) as string[]);

  let count = 0;
  for (const s of rows) {
    if (!s.scheduled_at) continue;
    if (alreadySent.has(s.id)) continue;

    const date = fmtDate(s.scheduled_at);
    const time = fmtTime(s.scheduled_at);
    const location = s.location_preference === "online" ? "Online" : s.location ?? "In person";
    const subjectName = s.subject?.name ?? "your subject";

    const sends: Array<Promise<boolean>> = [];

    if (s.tutor?.email && s.requester) {
      const d: ReminderDetails = {
        subjectName,
        date,
        time,
        location,
        counterpartName: s.requester.first_name,
        role: "tutor",
      };
      sends.push(
        sessionReminder({ email: s.tutor.email, name: s.tutor.first_name, id: s.tutor.id }, d, {
          org_id: s.org_id,
          session_id: s.id,
        }),
      );
    }
    if (s.requester?.email && s.tutor) {
      const d: ReminderDetails = {
        subjectName,
        date,
        time,
        location,
        counterpartName: s.tutor.first_name,
        role: "requester",
      };
      sends.push(
        sessionReminder({ email: s.requester.email, name: s.requester.first_name, id: s.requester.id }, d, {
          org_id: s.org_id,
          session_id: s.id,
        }),
      );
    }

    if (sends.length > 0) {
      await Promise.allSettled(sends);
      count += 1;
    }
  }

  return count;
}
