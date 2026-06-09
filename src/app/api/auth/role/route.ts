export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

// GET /api/auth/role — auth.py: get_role
// Return role of current user: superadmin|admin|tutor|tutee|null.
// Never raise uncaught errors; fall back to role null to avoid frontend hard failure.
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    // Check admin first
    try {
      const { data } = await auth.supabase
        .from("admins")
        .select("role")
        .eq("auth_id", userId)
        .limit(1);
      if (data && data.length > 0) {
        const row = data[0];
        if (row) {
          return json({ role: (row as { role?: unknown }).role ?? null });
        }
      }
    } catch {
      /* ignore */
    }

    // Tutor
    try {
      const { data } = await auth.supabase
        .from("tutors")
        .select("id")
        .eq("auth_id", userId)
        .limit(1);
      if (data && data.length > 0) {
        return json({ role: "tutor" });
      }
    } catch {
      /* ignore */
    }

    // Tutee
    try {
      const { data } = await auth.supabase
        .from("tutees")
        .select("id")
        .eq("auth_id", userId)
        .limit(1);
      if (data && data.length > 0) {
        return json({ role: "tutee" });
      }
    } catch {
      /* ignore */
    }

    return json({ role: null });
  } catch {
    // Final safety net: do not 500 on role checks
    return json({ role: null, error: "role_check_failed" });
  }
}
