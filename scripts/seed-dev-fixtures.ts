/**
 * scripts/seed-dev-fixtures.ts — deterministic DEV-ONLY fixture set.
 *
 * Builds the canonical persona matrix the verification suite (plan §10.1/§10.3)
 * probes against. Strictly idempotent (lookup-then-converge), refuses to run
 * unless ALLOW_DEV_SEED=1, and is NEVER a migration.
 *
 * Persona matrix (plan §9.4(c)):
 *   Org A "Scire Dev Org A"
 *     mgrA   — manager, ACTIVE
 *     m1     — member,  ACTIVE, ONE approved subject_approvals row (Math triple)
 *     m2     — member,  ACTIVE, no approvals  (also the requester of the Org A open session)
 *     m3     — member,  PENDING
 *   Org B "Scire Dev Org B"
 *     mgrB   — manager, ACTIVE
 *     mgrB2  — manager, PENDING               (pending-manager modal probe)
 *     m4     — member,  ACTIVE                (requester of the Org B open session)
 *   + 1 open session in Org A on m1's approved subject (m1 can claim; isolation probe)
 *   + 1 open session in Org B                          (cross-org isolation probe)
 *
 * Orgs are created via DIRECT service-role INSERT (the public.create_organization
 * RPC RAISEs under the service role — auth.uid() is NULL, so private.is_admin()
 * is false; documented divergence — production orgs always go through the RPC).
 * The org subject catalog is copied from subject_templates the same way the RPC
 * does (read templates → bulk insert per org). Auth users are created ORGS FIRST
 * because handle_new_user RAISEs on a missing/inactive org_id.
 *
 * Run:  npm run seed:dev
 *   (= node --env-file=.env.local --import tsx scripts/seed-dev-fixtures.ts)
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, ALLOW_DEV_SEED=1.
 * Optional env: DEV_FIXTURE_PASSWORD (default below). Passwords are never printed.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_DEV_PASSWORD = "Scire-Dev-Passw0rd!";

type Kind = "member" | "manager";

interface Persona {
  /** Stable key used to build the deterministic email scire-dev-<key>@example.test. */
  key: string;
  kind: Kind;
  firstName: string;
  lastName: string;
  /** Which org this persona belongs to. */
  org: "A" | "B";
  /** Target status after the service-role flip. */
  status: "active" | "pending";
}

const PERSONAS: Persona[] = [
  { key: "mgrA", kind: "manager", firstName: "Morgan", lastName: "AyersA", org: "A", status: "active" },
  { key: "m1", kind: "member", firstName: "Mia", lastName: "OneA", org: "A", status: "active" },
  { key: "m2", kind: "member", firstName: "Max", lastName: "TwoA", org: "A", status: "active" },
  { key: "m3", kind: "member", firstName: "Mara", lastName: "ThreeA", org: "A", status: "pending" },
  { key: "mgrB", kind: "manager", firstName: "Blake", lastName: "AyersB", org: "B", status: "active" },
  { key: "mgrB2", kind: "manager", firstName: "Bailey", lastName: "PendingB", org: "B", status: "pending" },
  { key: "m4", kind: "member", firstName: "Mark", lastName: "FourB", org: "B", status: "active" },
];

const ORGS = {
  A: { name: "Scire Dev Org A", slug: "scire-dev-org-a" },
  B: { name: "Scire Dev Org B", slug: "scire-dev-org-b" },
} as const;

/** Sentinel embedded in seeded session notes so the run is idempotent. */
const SESSION_SENTINEL = "[scire-dev-fixture]";

function emailFor(key: string): string {
  return `scire-dev-${key}@example.test`;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required env var ${name}`);
  }
  return value.trim();
}

async function main(): Promise<void> {
  if (process.env.ALLOW_DEV_SEED !== "1") {
    throw new Error("Refusing to seed dev fixtures: set ALLOW_DEV_SEED=1 to proceed.");
  }

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = requireEnv("SUPABASE_SECRET_KEY");
  const password = process.env.DEV_FIXTURE_PASSWORD?.trim() || DEFAULT_DEV_PASSWORD;

  const db = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  console.log("[seed-dev] converging dev fixtures …");

  // 1) Organizations FIRST (the handle_new_user trigger RAISEs on a missing org).
  const orgAId = await convergeOrg(db, ORGS.A.name, ORGS.A.slug);
  const orgBId = await convergeOrg(db, ORGS.B.name, ORGS.B.slug);
  const orgIds: Record<"A" | "B", string> = { A: orgAId, B: orgBId };

  // 2) Copy the default subject catalog into each org (mirrors the RPC's copy-all).
  await convergeOrgSubjects(db, orgAId);
  await convergeOrgSubjects(db, orgBId);

  // 3) Auth users → profiles (trigger creates them PENDING), then status flips.
  const profileIds = new Map<string, string>();
  for (const persona of PERSONAS) {
    const id = await convergeUser(db, persona, orgIds[persona.org], password);
    profileIds.set(persona.key, id);
    await convergeStatus(db, id, persona);
  }

  // 4) m1's single approved subject_approvals row (the "Math triple").
  const m1Id = profileIds.get("m1")!;
  const mgrAId = profileIds.get("mgrA")!;
  const orgASubjectId = await pickApprovalSubject(db, orgAId);
  await convergeApproval(db, {
    orgId: orgAId,
    profileId: m1Id,
    orgSubjectId: orgASubjectId,
    decidedBy: mgrAId,
  });

  // 5) Open session requests: Org A on m1's approved subject (claimable by m1),
  //    Org B as a cross-org isolation probe.
  const m2Id = profileIds.get("m2")!;
  const m4Id = profileIds.get("m4")!;
  const orgBSubjectId = await pickApprovalSubject(db, orgBId);
  await convergeOpenSession(db, {
    orgId: orgAId,
    requesterId: m2Id,
    orgSubjectId: orgASubjectId,
    notes: `${SESSION_SENTINEL} Need help preparing for the upcoming math unit test.`,
  });
  await convergeOpenSession(db, {
    orgId: orgBId,
    requesterId: m4Id,
    orgSubjectId: orgBSubjectId,
    notes: `${SESSION_SENTINEL} Looking for a tutor to review last week's lesson.`,
  });

  printPersonaTable(orgIds);
  console.log("[seed-dev] done.");
}

/** Insert an org if its slug is free; otherwise return the existing row's id. */
async function convergeOrg(db: SupabaseClient, name: string, slug: string): Promise<string> {
  const { data: existing, error: selErr } = await db
    .from("organizations")
    .select("id, archived_at")
    .eq("slug", slug)
    .maybeSingle();
  if (selErr) {
    throw new Error(`Failed to look up org '${slug}': ${selErr.message}`);
  }
  if (existing) {
    if (existing.archived_at) {
      // Restore so the slug/org is usable by signups again.
      const { error: restoreErr } = await db
        .from("organizations")
        .update({ archived_at: null })
        .eq("id", existing.id);
      if (restoreErr) {
        throw new Error(`Failed to restore archived org '${slug}': ${restoreErr.message}`);
      }
    }
    return existing.id as string;
  }
  const { data, error } = await db
    .from("organizations")
    .insert({ name, slug })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Failed to create org '${slug}': ${error?.message ?? "no row"}`);
  }
  console.log(`[seed-dev] created org ${slug} (${data.id})`);
  return data.id as string;
}

/**
 * Replicate the RPC's copy-all-template-rows behaviour with PostgREST: read the
 * default catalog and bulk-insert it into the org. Skips work if the org already
 * has a catalog (idempotent; avoids NULLS-NOT-DISTINCT upsert edge cases).
 */
async function convergeOrgSubjects(db: SupabaseClient, orgId: string): Promise<void> {
  const { count, error: countErr } = await db
    .from("org_subjects")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (countErr) {
    throw new Error(`Failed to count org_subjects for ${orgId}: ${countErr.message}`);
  }
  if ((count ?? 0) > 0) {
    return;
  }

  const { data: templates, error: tplErr } = await db
    .from("subject_templates")
    .select("name, category, grade_level");
  if (tplErr) {
    throw new Error(`Failed to read subject_templates: ${tplErr.message}`);
  }
  if (!templates || templates.length === 0) {
    throw new Error("subject_templates is empty — run migration 10 (seed_subject_template) first.");
  }

  const rows = templates.map((t) => ({
    org_id: orgId,
    name: t.name,
    category: t.category,
    grade_level: t.grade_level,
  }));
  const { error: insErr } = await db.from("org_subjects").insert(rows);
  if (insErr) {
    throw new Error(`Failed to copy catalog into org ${orgId}: ${insErr.message}`);
  }
  console.log(`[seed-dev] copied ${rows.length} catalog rows into org ${orgId}`);
}

/**
 * Pick a deterministic subject for approvals/sessions: prefer a Math* subject
 * (Academic, lowest grade) so the fixture reads as the "Math triple"; fall back
 * to the first active subject by (name, category, grade_level). The exact
 * template name is owned by migration 10, so we match tolerantly.
 */
async function pickApprovalSubject(db: SupabaseClient, orgId: string): Promise<string> {
  const { data, error } = await db
    .from("org_subjects")
    .select("id, name, category, grade_level")
    .eq("org_id", orgId)
    .eq("active", true)
    .order("name", { ascending: true })
    .order("category", { ascending: true })
    .order("grade_level", { ascending: true });
  if (error) {
    throw new Error(`Failed to read org_subjects for ${orgId}: ${error.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error(`No active org_subjects for org ${orgId}.`);
  }
  const math = data.find((s) => /^math/i.test((s.name ?? "") as string));
  const chosen = math ?? data[0];
  return chosen.id as string;
}

/** Create the auth user (with kind/org metadata) if absent; return its id. */
async function convergeUser(
  db: SupabaseClient,
  persona: Persona,
  orgId: string,
  password: string,
): Promise<string> {
  const email = emailFor(persona.key);
  const existing = await findUserByEmail(db, email);
  if (existing) {
    return existing.id;
  }
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      kind: persona.kind,
      org_id: orgId,
      first_name: persona.firstName,
      last_name: persona.lastName,
    },
  });
  if (error || !data.user) {
    throw new Error(`Failed to create user ${email}: ${error?.message ?? "no user"}`);
  }
  console.log(`[seed-dev] created user ${email} (${data.user.id})`);
  return data.user.id;
}

/**
 * Flip the trigger-created PENDING profile to its target status. handle_new_user
 * forces non-admins to 'pending'; profiles_guard exempts the service role for
 * this status promotion. Pending personas are left as-is.
 */
async function convergeStatus(db: SupabaseClient, profileId: string, persona: Persona): Promise<void> {
  // Wait briefly for the AFTER-INSERT trigger row (normally present immediately).
  const row = await waitForProfile(db, profileId);
  if (persona.status === "active" && row.status !== "active") {
    const { error } = await db
      .from("profiles")
      .update({ status: "active", activated_at: new Date().toISOString() })
      .eq("id", profileId);
    if (error) {
      throw new Error(`Failed to activate ${persona.key}: ${error.message}`);
    }
  }
}

async function waitForProfile(
  db: SupabaseClient,
  profileId: string,
): Promise<{ status: string }> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data, error } = await db
      .from("profiles")
      .select("status")
      .eq("id", profileId)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to read profile ${profileId}: ${error.message}`);
    }
    if (data) {
      return data as { status: string };
    }
    await sleep(200);
  }
  throw new Error(`Profile ${profileId} never materialised — is handle_new_user installed?`);
}

/** Upsert m1's one approved (profile_id, org_subject_id) row by the UNIQUE pair. */
async function convergeApproval(
  db: SupabaseClient,
  args: { orgId: string; profileId: string; orgSubjectId: string; decidedBy: string },
): Promise<void> {
  const { data: existing, error: selErr } = await db
    .from("subject_approvals")
    .select("id, status")
    .eq("profile_id", args.profileId)
    .eq("org_subject_id", args.orgSubjectId)
    .maybeSingle();
  if (selErr) {
    throw new Error(`Failed to look up approval: ${selErr.message}`);
  }
  if (existing) {
    if (existing.status !== "approved") {
      const { error } = await db
        .from("subject_approvals")
        .update({
          status: "approved",
          evidence: "97% in MHF4U",
          decision_note: "Seeded dev approval",
          direct_grant: false,
          decided_by: args.decidedBy,
          decided_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) {
        throw new Error(`Failed to converge approval: ${error.message}`);
      }
    }
    return;
  }
  const { error } = await db.from("subject_approvals").insert({
    org_id: args.orgId,
    profile_id: args.profileId,
    org_subject_id: args.orgSubjectId,
    status: "approved",
    evidence: "97% in MHF4U",
    decision_note: "Seeded dev approval",
    direct_grant: false,
    decided_by: args.decidedBy,
    decided_at: new Date().toISOString(),
  });
  if (error) {
    throw new Error(`Failed to insert approval: ${error.message}`);
  }
  console.log(`[seed-dev] approved m1 for org_subject ${args.orgSubjectId}`);
}

/** Insert one open session if a matching sentinel session does not already exist. */
async function convergeOpenSession(
  db: SupabaseClient,
  args: { orgId: string; requesterId: string; orgSubjectId: string; notes: string },
): Promise<void> {
  const { data: existing, error: selErr } = await db
    .from("sessions")
    .select("id")
    .eq("org_id", args.orgId)
    .eq("requester_id", args.requesterId)
    .eq("org_subject_id", args.orgSubjectId)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();
  if (selErr) {
    throw new Error(`Failed to look up open session: ${selErr.message}`);
  }
  if (existing) {
    return;
  }
  const { error } = await db.from("sessions").insert({
    org_id: args.orgId,
    requester_id: args.requesterId,
    org_subject_id: args.orgSubjectId,
    status: "open",
    priority: "normal",
    location_preference: "online",
    notes: args.notes,
  });
  if (error) {
    throw new Error(`Failed to insert open session: ${error.message}`);
  }
  console.log(`[seed-dev] opened session in org ${args.orgId} (requester ${args.requesterId})`);
}

type AdminUser = { id: string; email?: string | null };

async function findUserByEmail(db: SupabaseClient, email: string): Promise<AdminUser | null> {
  const target = email.toLowerCase();
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }
    const match = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) {
      return { id: match.id, email: match.email };
    }
    if (data.users.length < perPage) {
      return null;
    }
  }
}

function printPersonaTable(orgIds: Record<"A" | "B", string>): void {
  console.log("\n  Persona fixtures (emails only — passwords are never printed):");
  console.log("  ┌──────────┬──────────┬──────────┬─────────┬─────────────────────────────────┐");
  console.log("  │ persona  │ org      │ kind     │ status  │ email                           │");
  console.log("  ├──────────┼──────────┼──────────┼─────────┼─────────────────────────────────┤");
  for (const p of PERSONAS) {
    const note = p.key === "m1" ? " (approved: Math)" : "";
    console.log(
      `  │ ${pad(p.key, 8)} │ ${pad(`Org ${p.org}`, 8)} │ ${pad(p.kind, 8)} │ ${pad(p.status, 7)} │ ${pad(emailFor(p.key) + note, 31)} │`,
    );
  }
  console.log("  └──────────┴──────────┴──────────┴─────────┴─────────────────────────────────┘");
  console.log(`  Org A id: ${orgIds.A}`);
  console.log(`  Org B id: ${orgIds.B}`);
  console.log("  + 1 open session in Org A (requester m2, on m1's approved subject)");
  console.log("  + 1 open session in Org B (requester m4)");
}

function pad(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value.padEnd(width, " ");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err: unknown) => {
  console.error(`[seed-dev] FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
