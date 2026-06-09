import { json } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { sendSessionReminders } from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/send-reminders
 * Cron-triggered: send "session tomorrow" reminders. Authorized via CRON_SECRET.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader !== "Bearer " + process.env.CRON_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }
  const c = createServiceClient();
  const count = await sendSessionReminders(c);
  return json({ message: "ok", count });
}
