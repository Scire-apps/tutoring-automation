import { requireActiveManager } from "@/lib/auth";
import { json, notFound, serverError } from "@/lib/http";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  subject: string;
  body: string | null;
  status: "sent" | "failed";
  recipient_email: string;
  recipient_id: string | null;
  created_at: string;
  recipient: { first_name: string; last_name: string } | null;
  sender: { first_name: string; last_name: string } | null;
};

const fullName = (p: { first_name: string; last_name: string } | null): string | null =>
  p ? `${p.first_name} ${p.last_name}`.trim() || null : null;

/**
 * GET /api/manage/emails/[id] — one broadcast batch detail (§5.12). `[id]` is the
 * batch_id; returns the batch summary (subject, sender, when, recipient count),
 * the shared body, and the per-recipient sent/failed list (with display names).
 * org_id is server-derived; RLS (`managed_org`) scopes email_log to the org, so a
 * foreign batch 404s.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const { id } = await ctx.params;

  const { data, error } = await supabase
    .from("email_log")
    .select(
      `id, subject, body, status, recipient_email, recipient_id, created_at,
       recipient:profiles!email_log_recipient_id_fkey ( first_name, last_name ),
       sender:profiles!email_log_sender_id_fkey ( first_name, last_name )`,
    )
    .eq("org_id", orgId)
    .eq("kind", "manager_broadcast")
    .eq("batch_id", id)
    .order("recipient_email", { ascending: true });

  if (error) return serverError("server_error", "Failed to load the broadcast");
  const rows = (data as unknown as Row[]) ?? [];
  if (rows.length === 0) return notFound("not_found", "Broadcast not found");

  const sentCount = rows.filter((r) => r.status === "sent").length;
  const first = rows[0];
  const sentAt = rows.reduce((min, r) => (r.created_at < min ? r.created_at : min), first.created_at);

  return json({
    batch: {
      batch_id: id,
      subject: first.subject,
      sender_name: fullName(first.sender),
      recipient_count: rows.length,
      sent_count: sentCount,
      failed_count: rows.length - sentCount,
      created_at: sentAt,
    },
    body: first.body,
    recipients: rows.map((r) => ({
      id: r.id,
      recipient_email: r.recipient_email,
      recipient_name: fullName(r.recipient),
      status: r.status,
    })),
  });
}
