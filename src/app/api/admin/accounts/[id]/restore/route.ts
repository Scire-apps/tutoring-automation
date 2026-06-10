import { requireAdmin } from "@/lib/auth";
import { runKindlessTransition } from "@/lib/admin/lifecycle";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/accounts/[id]/restore — restore a suspended OR rejected member/
 * manager → active (§6.4 / §1.5: suspended→active, rejected→active). status_note
 * clears; activated_* re-stamped. 409 `invalid_state` if already active/pending.
 * Members are emailed a restoration notice; the profiles_audit trigger records it.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  return runKindlessTransition(
    supabase,
    user.id,
    id,
    { from: ["suspended", "rejected"], status: "active", reactivate: true, setNote: false, note: null },
    "restored",
  );
}
