import { after } from "next/server";
import { z } from "zod";
import { requireActiveManager } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { readOrgProfile, orgNameFor } from "@/lib/manage/members";
import { toManageManagerDTO } from "@/lib/manage/dtos";
import { managerActivated, siteUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

const decideSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional().nullable(),
});

/**
 * PATCH /api/manage/managers/[id] {decision, note?} — decide a PENDING peer
 * manager in MY org (§5.7): approve → active (+activation email) or reject →
 * rejected (+rejection email, optional note). Pending-only (the profiles guard
 * permits a manager to move only a PENDING peer). Returns the updated manager
 * row. org_id is server-derived.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, decideSchema);
  if (!parsed.ok) return parsed.response;
  const { decision } = parsed.data;
  const note = parsed.data.note ?? null;

  const before = await readOrgProfile(supabase, orgId, id, "manager");
  if (!before) return notFound("not_found", "Manager not found");
  if (before.status !== "pending") {
    return conflict("invalid_state", "Only a pending manager can be decided", { status: before.status });
  }

  const update =
    decision === "approve"
      ? { status: "active" as const, activated_at: new Date().toISOString(), activated_by: user.id }
      : { status: "rejected" as const, status_note: note };

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("kind", "manager")
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readOrgProfile(supabase, orgId, id, "manager");
    if (!current) return notFound("not_found", "Manager not found");
    return conflict("invalid_state", "The manager could not be decided", { status: current.status });
  }

  const orgName = await orgNameFor(supabase, orgId);
  const recipient = { email: before.email, name: before.first_name, id: before.id };
  if (decision === "approve") {
    after(() =>
      managerActivated(recipient, orgName, "activated", null, {
        org_id: orgId,
        dashboardUrl: `${siteUrl()}/manager/dashboard`,
      }),
    );
  } else {
    after(() => managerActivated(recipient, orgName, "rejected", note, { org_id: orgId }));
  }

  return json(toManageManagerDTO(updated));
}
