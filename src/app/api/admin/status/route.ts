import { requireAdmin } from "@/lib/auth";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

type Check = { name: "database" | "email" | "cron"; status: "ok" | "degraded" | "down"; detail: string };

/**
 * GET /api/admin/status — admin-only service health (§6.4, successor of the
 * deleted `/api/services/status`, which leaked config to any authed user). Probes
 * three subsystems and reports a per-check status with a NON-SECRET detail
 * (configured-or-not booleans, never key values):
 *   - database: a trivial RLS-bound read;
 *   - email: whether Mailjet + sender are configured (or dry-run mode);
 *   - cron: whether CRON_SECRET is set (the reminder job's auth).
 * `status` is the worst of the three. requireAdmin gates the whole route.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  // Database reachability via a trivial count (admin sees all orgs).
  let database: Check;
  try {
    const { error } = await supabase.from("organizations").select("id", { count: "exact", head: true });
    database = error
      ? { name: "database", status: "degraded", detail: "Query error" }
      : { name: "database", status: "ok", detail: "Reachable" };
  } catch {
    database = { name: "database", status: "down", detail: "Unreachable" };
  }

  // Email configuration (no secret values — booleans only).
  const dryRun = process.env.EMAIL_DRY_RUN === "1";
  const mailjetConfigured =
    !!process.env.MAILJET_API_KEY && !!process.env.MAILJET_API_SECRET && !!process.env.EMAIL_FROM;
  const email: Check = dryRun
    ? { name: "email", status: "degraded", detail: "Dry-run mode (no live sends)" }
    : mailjetConfigured
      ? { name: "email", status: "ok", detail: "Mailjet configured" }
      : { name: "email", status: "down", detail: "Mailjet not configured" };

  // Cron auth (the reminder job rejects without CRON_SECRET).
  const cron: Check = process.env.CRON_SECRET
    ? { name: "cron", status: "ok", detail: "Secret configured" }
    : { name: "cron", status: "down", detail: "CRON_SECRET not set" };

  const checks: Check[] = [database, email, cron];
  const status: Check["status"] = checks.some((c) => c.status === "down")
    ? "down"
    : checks.some((c) => c.status === "degraded")
      ? "degraded"
      : "ok";

  return json({ status, checks });
}
