import { requireAdmin } from "@/lib/auth";
import { parseBody } from "@/lib/validation";
import { suspendSchema } from "@/lib/admin/schemas";
import { runKindlessTransition } from "@/lib/admin/lifecycle";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/accounts/[id]/suspend {note?} — suspend an ACTIVE member or
 * manager → suspended (§6.4). Suspending a MANAGER is an admin-only power (managers
 * cannot suspend peers — anti rogue-manager lockout, §5.7). `note` → member-visible
 * status_note. 409 `invalid_state` if not active. Members are emailed a suspension
 * notice; the profiles_audit trigger records the change.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, suspendSchema);
  if (!parsed.ok) return parsed.response;
  const note = parsed.data.note ?? null;

  return runKindlessTransition(
    supabase,
    user.id,
    id,
    { from: ["active"], status: "suspended", setNote: true, note },
    "suspended",
  );
}
