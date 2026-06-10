import { requireAdmin } from "@/lib/auth";
import { runTransition } from "@/lib/admin/lifecycle";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/accounts/[id]/approve — activate a pending MANAGER → active
 * (§6.4). This is where an org's FIRST manager is activated (the back-office of
 * the contact-Scire modal); later managers can also be approved in-org. 409
 * `wrong_kind` if not a manager; 409 `invalid_state` if not pending. activated_*
 * stamped; the manager is emailed an activation notice.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  return runTransition(supabase, user.id, id, {
    requireKind: "manager",
    from: ["pending"],
    noun: "Manager",
    patch: (actorId) => ({
      status: "active",
      status_note: null,
      activated_at: new Date().toISOString(),
      activated_by: actorId,
    }),
    email: () => ({ kind: "manager", decision: "activated", note: null }),
  });
}
