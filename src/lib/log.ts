/**
 * Service-confined logging into the two append-only tables, `email_log` and
 * `audit_log` (§2.6). Both are SELECT-only for `authenticated` and have
 * UPDATE/DELETE revoked from EVERY role — the service-role client is the sole
 * INSERT path, so these rows are unforgeable via direct PostgREST.
 *
 * Server-only. Never import from client code.
 */
import type { Database } from "@/types/database";
import { createServiceClient } from "@/lib/supabase/server";

type EmailStatus = Database["public"]["Enums"]["email_status"];
type AccountKind = Database["public"]["Enums"]["account_kind"];

export type LogEmailInput = {
  recipient_email: string;
  subject: string;
  status: EmailStatus;
  body?: string | null;
  kind?: string | null;
  org_id?: string | null;
  /** NULL = system/cron sender. */
  sender_id?: string | null;
  recipient_id?: string | null;
  session_id?: string | null;
  /** Shared across all rows of a single broadcast. */
  batch_id?: string | null;
  metadata?: Database["public"]["Tables"]["email_log"]["Insert"]["metadata"];
};

/**
 * Insert one `email_log` row (the sole INSERT path — §2.7). Call after every
 * transactional send, recording the snapshot recipient_email and the outcome.
 * Best-effort: a failed log never throws into the handler; it logs and returns.
 */
export async function logEmail(input: LogEmailInput): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("email_log").insert({
      recipient_email: input.recipient_email,
      subject: input.subject,
      status: input.status,
      body: input.body ?? null,
      kind: input.kind ?? null,
      org_id: input.org_id ?? null,
      sender_id: input.sender_id ?? null,
      recipient_id: input.recipient_id ?? null,
      session_id: input.session_id ?? null,
      batch_id: input.batch_id ?? null,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    });
    if (error) console.error("[log] logEmail insert failed:", error.message);
  } catch (e) {
    console.error("[log] logEmail threw:", e);
  }
}

export type LogAuditInput = {
  /** Dotted action, e.g. "admin.login", "hours.adjusted", "manager.invite". */
  action: string;
  /** Verified actor (the authenticated caller from the guard). NULL = system. */
  actor_id?: string | null;
  actor_kind?: AccountKind | null;
  org_id?: string | null;
  target_table?: string | null;
  target_id?: string | null;
  metadata?: Database["public"]["Tables"]["audit_log"]["Insert"]["metadata"];
};

/**
 * Insert one `audit_log` row for an APP-ONLY event (admin login, manager invite,
 * an admin/manager mutation done through a route rather than a DB trigger).
 * Mutations performed by guarded UPDATEs are already audited by the SECURITY
 * DEFINER trigger suite — do NOT double-log those.
 *
 * The route has already authorized the caller, so `actor_id` is the verified uid
 * supplied by the guard (mirrors `private.log_audit`'s actor-forcing). Best-effort.
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("audit_log").insert({
      action: input.action,
      actor_id: input.actor_id ?? null,
      actor_kind: input.actor_kind ?? null,
      org_id: input.org_id ?? null,
      target_table: input.target_table ?? null,
      target_id: input.target_id ?? null,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    });
    if (error) console.error("[log] logAudit insert failed:", error.message);
  } catch (e) {
    console.error("[log] logAudit threw:", e);
  }
}
