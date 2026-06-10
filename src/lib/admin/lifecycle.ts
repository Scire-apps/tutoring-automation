/**
 * Shared account-lifecycle transitions for `/api/admin/accounts/[id]/*` (§6.4).
 * Each is a guarded UPDATE on profiles via the admin's RLS-bound client (the
 * profiles_guard admin branch permits status flips on ANY profile; kind/org_id
 * stay immutable). A kind mismatch → 409 `wrong_kind`; an illegal status → 409
 * `invalid_state`. The profiles_audit trigger records the status change; the
 * caller emails the affected account afterwards. org_id is NOT scoped (admin is
 * cross-org).
 */
import { after } from "next/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { readAccount } from "@/lib/admin/accounts";
import { orgNameFor } from "@/lib/admin/recipients";
import { toAdminAccountDTO, type ProfileWithOrg } from "@/lib/admin/dtos";
import { accountStatusChanged, managerActivated, siteUrl } from "@/lib/email";

type AccountKind = Database["public"]["Enums"]["account_kind"];
type AccountStatus = Database["public"]["Enums"]["account_status"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

/** The email side-effect to fire after a successful transition (or none). */
type EmailEffect =
  | { kind: "member"; status: "active" | "rejected" | "suspended"; context: "admitted" | "restored" | "rejected" | "suspended"; note: string | null }
  | { kind: "manager"; decision: "activated" | "rejected"; note: string | null }
  | { kind: "none" };

type TransitionSpec = {
  /** Which account kind this verb targets (409 wrong_kind otherwise). */
  requireKind: AccountKind;
  /** Legal current statuses for this transition (409 invalid_state otherwise). */
  from: AccountStatus[];
  /** The patch to apply (status plus activated fields / status_note as needed). */
  patch: (actorId: string) => ProfileUpdate;
  /** Human label for the wrong-kind message. */
  noun: string;
  /** Build the email effect from the (pre-update) account row + org name. */
  email: (account: ProfileWithOrg, orgName: string) => EmailEffect;
};

/**
 * Run a guarded profiles transition and return the updated account DTO. Shared by
 * admit / approve / reject / suspend / restore. The status guard in the UPDATE
 * makes a re-call idempotent (0 rows → 409). The email fires via after().
 */
export async function runTransition(
  supabase: SupabaseClient<Database>,
  actorId: string,
  id: string,
  spec: TransitionSpec,
): Promise<NextResponse> {
  const account = await readAccount(supabase, id);
  if (!account) return notFound("not_found", `${spec.noun} not found`);
  if (account.kind !== spec.requireKind) {
    return conflict("wrong_kind", `That account is a ${account.kind}, not a ${spec.requireKind}`, {
      kind: account.kind,
    });
  }
  if (!spec.from.includes(account.status)) {
    return conflict("invalid_state", `This ${spec.noun.toLowerCase()} cannot make that change`, {
      status: account.status,
    });
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(spec.patch(actorId))
    .eq("id", id)
    .eq("kind", spec.requireKind)
    .in("status", spec.from)
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readAccount(supabase, id);
    if (!current) return notFound("not_found", `${spec.noun} not found`);
    return conflict("invalid_state", `The ${spec.noun.toLowerCase()} could not be updated`, {
      status: current.status,
    });
  }

  const fresh = await readAccount(supabase, id);
  if (!fresh) return serverError("server_error", "Updated but the account could not be reloaded");

  const orgName = await orgNameFor(supabase, account.org_id);
  const effect = spec.email(account, orgName);
  const recipient = { email: account.email, name: account.first_name, id: account.id };

  if (effect.kind === "member") {
    after(() =>
      accountStatusChanged(recipient, orgName, effect.status, effect.context, effect.note, {
        org_id: account.org_id,
        dashboardUrl: `${siteUrl()}/member/dashboard`,
      }),
    );
  } else if (effect.kind === "manager") {
    after(() =>
      managerActivated(recipient, orgName, effect.decision, effect.note, {
        org_id: account.org_id,
        dashboardUrl: `${siteUrl()}/manager/dashboard`,
      }),
    );
  }

  return json(toAdminAccountDTO(fresh));
}

/** A kind-agnostic status change (reject / suspend / restore) — works for member OR manager. */
type KindlessSpec = {
  /** Legal current statuses (409 invalid_state otherwise). */
  from: AccountStatus[];
  /** New status to set. */
  status: AccountStatus;
  /** When true, stamp activated_at/by (restore re-activation). */
  reactivate?: boolean;
  /** When true, set status_note from `note`; otherwise clear it. */
  setNote: boolean;
  /** The member-visible note (reject/suspend); ignored unless setNote. */
  note: string | null;
};

/**
 * Run a kind-agnostic profiles transition (reject / suspend / restore) for a
 * member OR manager. Members get the `accountStatusChanged` email; managers get
 * the `managerActivated` rejected-notice on reject and nothing on suspend/restore
 * (no manager suspend/restore template exists — a member-style status email would
 * misname the role). Returns the updated account DTO.
 */
export async function runKindlessTransition(
  supabase: SupabaseClient<Database>,
  actorId: string,
  id: string,
  spec: KindlessSpec,
  context: "rejected" | "suspended" | "restored",
): Promise<NextResponse> {
  const account = await readAccount(supabase, id);
  if (!account) return notFound("not_found", "Account not found");
  if (account.kind === "admin") {
    return conflict("wrong_kind", "Admin accounts are not managed here", { kind: account.kind });
  }
  if (!spec.from.includes(account.status)) {
    return conflict("invalid_state", "This account cannot make that change", { status: account.status });
  }

  const patch: ProfileUpdate = { status: spec.status };
  if (spec.setNote) patch.status_note = spec.note;
  else patch.status_note = null;
  if (spec.reactivate) {
    patch.activated_at = new Date().toISOString();
    patch.activated_by = actorId;
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .in("status", spec.from)
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readAccount(supabase, id);
    if (!current) return notFound("not_found", "Account not found");
    return conflict("invalid_state", "The account could not be updated", { status: current.status });
  }

  const fresh = await readAccount(supabase, id);
  if (!fresh) return serverError("server_error", "Updated but the account could not be reloaded");

  const orgName = await orgNameFor(supabase, account.org_id);
  const recipient = { email: account.email, name: account.first_name, id: account.id };

  if (account.kind === "member") {
    const status = context === "restored" ? "active" : (context as "rejected" | "suspended");
    after(() =>
      accountStatusChanged(recipient, orgName, status, context, spec.setNote ? spec.note : null, {
        org_id: account.org_id,
        dashboardUrl: `${siteUrl()}/member/dashboard`,
      }),
    );
  } else if (account.kind === "manager" && context === "rejected") {
    after(() => managerActivated(recipient, orgName, "rejected", spec.setNote ? spec.note : null, { org_id: account.org_id }));
  }

  return json(toAdminAccountDTO(fresh));
}
