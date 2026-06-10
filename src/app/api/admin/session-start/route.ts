import { after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { json } from "@/lib/http";
import { logAudit } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/session-start — record an `admin.login` audit row (§6.1 / §6.4).
 * Called by `/admin-login` once the admin clears the (conditional TOTP) sign-in.
 * requireAdmin re-verifies the caller is an active admin at the right AAL, so the
 * actor is the VERIFIED uid (never a body field). audit_log has no login trigger,
 * so this is the sanctioned app-only audit event. Best-effort via after().
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  after(() =>
    logAudit({
      action: "admin.login",
      actor_id: user.id,
      actor_kind: "admin",
      target_table: "profiles",
      target_id: user.id,
    }),
  );

  return json({ ok: true }, 200);
}
