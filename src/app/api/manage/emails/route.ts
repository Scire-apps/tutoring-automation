import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { requireActiveManager } from "@/lib/auth";
import { json, listResponse, parseListParams, badRequest, rateLimited, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { broadcastSchema } from "@/lib/manage/schemas";
import { orgNameFor } from "@/lib/manage/members";
import {
  dailyCap,
  broadcastsSentToday,
  resolveBroadcastRecipients,
} from "@/lib/manage/emails";
import { broadcast } from "@/lib/email";
import { logAudit } from "@/lib/log";

export const dynamic = "force-dynamic";

type BatchSummary = {
  batch_id: string;
  subject: string;
  sent_at: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  sender_name: string | null;
  /** Alias of sent_at for the UI (the batch's send timestamp). */
  created_at: string;
};

type EmailLogRow = {
  batch_id: string | null;
  subject: string;
  status: "sent" | "failed";
  created_at: string;
  sender: { first_name: string; last_name: string } | null;
};

/**
 * GET /api/manage/emails — broadcast history grouped by batch_id (§5.12). Each
 * entry summarizes one broadcast: subject, sender, when, recipient count,
 * sent/failed tallies. Newest first, paginated over the aggregated batches.
 * org_id is server-derived; RLS (`managed_org`) scopes email_log to the org.
 */
export async function GET(req: Request) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const url = new URL(req.url);
  const { limit, offset } = parseListParams(url);

  const { data, error } = await supabase
    .from("email_log")
    .select("batch_id, subject, status, created_at, sender:profiles!email_log_sender_id_fkey ( first_name, last_name )")
    .eq("org_id", orgId)
    .eq("kind", "manager_broadcast")
    .not("batch_id", "is", null)
    .order("id", { ascending: false })
    .limit(5000);

  if (error) return serverError("server_error", "Failed to load email history");

  const byBatch = new Map<string, BatchSummary>();
  for (const r of (data as unknown as EmailLogRow[]) ?? []) {
    const key = r.batch_id as string;
    let b = byBatch.get(key);
    if (!b) {
      const senderName = r.sender ? `${r.sender.first_name} ${r.sender.last_name}`.trim() : "";
      b = {
        batch_id: key,
        subject: r.subject,
        sent_at: r.created_at,
        created_at: r.created_at,
        recipient_count: 0,
        sent_count: 0,
        failed_count: 0,
        sender_name: senderName || null,
      };
      byBatch.set(key, b);
    }
    b.recipient_count += 1;
    if (r.status === "sent") b.sent_count += 1;
    else b.failed_count += 1;
    // Keep the earliest created_at as the batch's sent time.
    if (r.created_at < b.sent_at) {
      b.sent_at = r.created_at;
      b.created_at = r.created_at;
    }
  }

  const batches = [...byBatch.values()].sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1));
  const page = batches.slice(offset, offset + limit);
  return listResponse(page, batches.length, { limit, offset });
}

/**
 * POST /api/manage/emails {scope, subject, body, member_ids?, subject_id?} —
 * compose a manager broadcast (§5.12 / §2.7). Recipients are resolved server-side
 * STRICTLY within the org; the body is plain text (escaped + wrapped in the fixed
 * Scire template with a "[OrgName]" subject prefix + attribution footer). A
 * per-org daily cap (ORG_EMAIL_DAILY_CAP, default 10) → 429. One email_log row
 * per recipient shares a minted batch_id; an explicit `manager.broadcast` audit
 * row records the send (email_log has no audit trigger). Sends dispatch via
 * after() so the response never blocks.
 */
export async function POST(req: Request) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth;

  const parsed = await parseBody(req, broadcastSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  // Daily cap (best-effort; counts distinct batches since UTC midnight).
  const sentToday = await broadcastsSentToday(supabase, orgId);
  if (sentToday >= dailyCap()) {
    return rateLimited("You have reached today's broadcast limit for your organization", {
      cap: dailyCap(),
      sent_today: sentToday,
    });
  }

  const recipients = await resolveBroadcastRecipients(supabase, orgId, data);
  // De-dupe by id (a member could match a scope twice in theory).
  const unique = [...new Map(recipients.map((r) => [r.id, r])).values()];
  if (unique.length === 0) {
    return badRequest("validation_error", "No recipients matched the selected audience");
  }

  const orgName = await orgNameFor(supabase, orgId);
  const batchId = randomUUID();

  // Dispatch one send per recipient (each logs an email_log row sharing batch_id).
  for (const r of unique) {
    after(() =>
      broadcast({
        recipient: { email: r.email, name: r.first_name, id: r.id },
        orgName,
        subject: data.subject,
        body: data.body,
        batchId,
        orgId,
        senderId: user.id,
      }),
    );
  }

  // Audit the broadcast (email_log has no audit trigger).
  after(() =>
    logAudit({
      action: "manager.broadcast",
      actor_id: user.id,
      actor_kind: "manager",
      org_id: orgId,
      target_table: "email_log",
      target_id: batchId,
      metadata: { scope: data.scope, subject: data.subject, recipient_count: unique.length },
    }),
  );

  return json({ batch_id: batchId, recipient_count: unique.length, scope: data.scope }, 202);
}
