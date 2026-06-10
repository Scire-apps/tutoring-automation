import { requireAdmin } from "@/lib/auth";
import { parseBody } from "@/lib/validation";
import { rejectSchema } from "@/lib/admin/schemas";
import { runKindlessTransition } from "@/lib/admin/lifecycle";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/accounts/[id]/reject {note?} — reject a PENDING member or manager
 * → rejected (§6.4). `note` → member-visible status_note. The account + its auth
 * user are RETAINED (the email stays claimed until an explicit delete; the
 * mistaken-signup runbook is delete-then-invite). 409 `invalid_state` if not
 * pending; admins aren't managed here (409 wrong_kind). Member/manager are emailed.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, rejectSchema);
  if (!parsed.ok) return parsed.response;
  const note = parsed.data.note ?? null;

  return runKindlessTransition(
    supabase,
    user.id,
    id,
    { from: ["pending"], status: "rejected", setNote: true, note },
    "rejected",
  );
}
