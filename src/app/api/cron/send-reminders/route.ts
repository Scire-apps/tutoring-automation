import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/send-reminders — DEMOLITION STUB.
 *
 * Authorized via CRON_SECRET so the Vercel daily cron entry (vercel.json) keeps
 * a valid, non-erroring target during the rebuild. The real org-aware reminder
 * pass is rebuilt in the member slice (§7.8); until then this is an authorized
 * no-op returning { count: 0 }.
 */
export async function GET(req: Request) {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader !== "Bearer " + process.env.CRON_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }
  return json({ count: 0 }, 200);
}
