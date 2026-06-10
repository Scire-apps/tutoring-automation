import { requireAdmin } from "@/lib/auth";
import { runTransition } from "@/lib/admin/lifecycle";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/accounts/[id]/admit — admit a pending MEMBER → active (§6.4),
 * an admin override of the manager admit power. 409 `wrong_kind` if the account is
 * not a member; 409 `invalid_state` if not pending. status_note clears; activated_*
 * stamped. The member is emailed; the profiles_audit trigger records the change.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  return runTransition(supabase, user.id, id, {
    requireKind: "member",
    from: ["pending"],
    noun: "Member",
    patch: (actorId) => ({
      status: "active",
      status_note: null,
      activated_at: new Date().toISOString(),
      activated_by: actorId,
    }),
    email: () => ({ kind: "member", status: "active", context: "admitted", note: null }),
  });
}
