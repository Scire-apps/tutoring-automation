import { requireActiveManager } from "@/lib/auth";
import { json, notFound, serverError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/manage/emails/[id] — one broadcast batch detail (§5.12). `[id]` is the
 * batch_id; returns the batch summary plus the per-recipient sent/failed list
 * (the body is shared across the batch, surfaced once). org_id is server-derived;
 * RLS (`managed_org`) scopes email_log to the org, so a foreign batch 404s.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const { id } = await ctx.params;

  const { data, error } = await supabase
    .from("email_log")
    .select("id, subject, body, status, recipient_email, recipient_id, created_at")
    .eq("org_id", orgId)
    .eq("kind", "manager_broadcast")
    .eq("batch_id", id)
    .order("recipient_email", { ascending: true });

  if (error) return serverError("server_error", "Failed to load the broadcast");
  const rows = data ?? [];
  if (rows.length === 0) return notFound("not_found", "Broadcast not found");

  const sentCount = rows.filter((r) => r.status === "sent").length;
  const first = rows[0];

  return json({
    batch_id: id,
    subject: first.subject,
    body: first.body,
    sent_at: rows.reduce((min, r) => (r.created_at < min ? r.created_at : min), first.created_at),
    recipient_count: rows.length,
    sent_count: sentCount,
    failed_count: rows.length - sentCount,
    recipients: rows.map((r) => ({
      recipient_email: r.recipient_email,
      recipient_id: r.recipient_id,
      status: r.status,
    })),
  });
}
