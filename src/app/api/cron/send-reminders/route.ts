import { timingSafeEqual } from "node:crypto";
import { json, unauthorized, serverError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { sendSessionReminders } from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Constant-time comparison of the Bearer token against CRON_SECRET (§2.9 / §7.8).
 * Length-guarded so `timingSafeEqual` never throws on mismatched buffer sizes,
 * and still constant-time within a length class.
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;
  const header = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * GET /api/cron/send-reminders — daily session-reminder job (§7.8). Authorized
 * by CRON_SECRET (timing-safe). Runs the org-aware reminder pass under the
 * service-role client: emails both parties of every session scheduled tomorrow
 * (UTC) exactly once (email_log is the retry-safe sent-marker). Returns the
 * number of sessions reminded. Wired to the Vercel daily cron in vercel.json.
 */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return unauthorized("unauthorized", "Invalid cron secret");
  }

  try {
    const supabase = createServiceClient();
    const count = await sendSessionReminders(supabase);
    return json({ count }, 200);
  } catch (e) {
    console.error("[cron/send-reminders] failed:", e);
    return serverError("server_error", "Reminder job failed");
  }
}
