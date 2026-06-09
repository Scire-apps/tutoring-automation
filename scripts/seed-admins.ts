/**
 * scripts/seed-admins.ts — seed (or converge) Scire app-wide Admin accounts.
 *
 * Admins are the Scire engineering team: there is NO public signup path. Each
 * account is created directly through the GoTrue Admin API with
 * `app_metadata.kind = 'admin'` (app_metadata is service-role-only, so this is
 * the ONLY route to an admin). The `private.handle_new_user` AFTER-INSERT
 * trigger reads that flag and materialises the `profiles` row as
 * kind=admin / status=active / org_id=NULL. This script then verifies/repairs
 * that row via the service role so the run is an idempotent converge.
 *
 * Run:  npm run seed:admins
 *   (= node --env-file=.env.local --import tsx scripts/seed-admins.ts)
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY,
 *               SEED_ADMIN_EMAIL, SEED_ADMIN_FIRST, SEED_ADMIN_LAST.
 * Optional env: SEED_ADMIN_PASSWORD — if unset, a strong password is generated
 *               and appended to ./.admin-credentials.local (gitignored) rather
 *               than printed. Credentials are NEVER written to stdout.
 */

import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const CREDENTIALS_FILE = "./.admin-credentials.local";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required env var ${name}`);
  }
  return value.trim();
}

/** URL-safe, ~24-byte (≈32-char) password; easily clears the min-10 policy. */
function generatePassword(): string {
  return randomBytes(24).toString("base64url");
}

async function main(): Promise<void> {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = requireEnv("SUPABASE_SECRET_KEY");
  const email = requireEnv("SEED_ADMIN_EMAIL").toLowerCase();
  const firstName = requireEnv("SEED_ADMIN_FIRST");
  const lastName = requireEnv("SEED_ADMIN_LAST");
  const providedPassword = process.env.SEED_ADMIN_PASSWORD?.trim();

  // Service-role client (bypasses RLS). Server/CLI only — never shipped to the browser.
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  console.log(`[seed-admins] converging admin ${email} …`);

  // 1) Exists-check by email (page through the admin user list).
  const existing = await findUserByEmail(admin, email);

  let userId: string;
  if (existing) {
    userId = existing.id;
    console.log(`[seed-admins] auth user already exists (${userId}); ensuring admin metadata`);
    // Converge auth-side: confirm email, ensure the admin flag, refresh names.
    // Only rotate the password when one is EXPLICITLY provided (an unset password
    // on an existing user must not silently lock the operator out).
    const updates: Record<string, unknown> = {
      email_confirm: true,
      app_metadata: { ...(existing.app_metadata ?? {}), kind: "admin" },
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        first_name: firstName,
        last_name: lastName,
      },
    };
    if (providedPassword) {
      updates.password = providedPassword;
    }
    const { error } = await admin.auth.admin.updateUserById(userId, updates);
    if (error) {
      throw new Error(`Failed to update admin auth user: ${error.message}`);
    }
  } else {
    // Generate a password if none supplied; record it to the gitignored file.
    const password = providedPassword ?? generatePassword();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { kind: "admin" },
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    if (error || !data.user) {
      throw new Error(`Failed to create admin auth user: ${error?.message ?? "no user returned"}`);
    }
    userId = data.user.id;
    console.log(`[seed-admins] created auth user ${userId}`);
    if (!providedPassword) {
      appendFileSync(
        CREDENTIALS_FILE,
        `${new Date().toISOString()}\t${email}\t${password}\n`,
        { encoding: "utf8", mode: 0o600 },
      );
      console.log(`[seed-admins] generated password appended to ${CREDENTIALS_FILE} (gitignored)`);
    }
  }

  // 2) Verify / repair the profile row (the trigger is the primary creator).
  await convergeProfile(admin, userId, { email, firstName, lastName });

  console.log(`[seed-admins] done — admin ${email} is active.`);
}

type AdminUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
};

/** Page through the GoTrue admin user list and match on email (case-insensitive). */
async function findUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<AdminUser | null> {
  const target = email.toLowerCase();
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }
    const match = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) {
      return match as AdminUser;
    }
    if (data.users.length < perPage) {
      return null;
    }
  }
}

/**
 * Ensure the admin's `profiles` row exists and is converged. kind and org_id are
 * immutable by trigger (and correct from `handle_new_user`), so we only assert
 * existence and, if drifted, nudge status back to 'active'. If the trigger never
 * fired (row missing), attempt a service-role insert as a fallback.
 */
async function convergeProfile(
  admin: SupabaseClient,
  userId: string,
  fields: { email: string; firstName: string; lastName: string },
): Promise<void> {
  const { data: row, error } = await admin
    .from("profiles")
    .select("id, kind, status, org_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to read admin profile: ${error.message}`);
  }

  if (!row) {
    console.warn(`[seed-admins] profile row missing for ${userId}; inserting fallback`);
    const { error: insertError } = await admin.from("profiles").insert({
      id: userId,
      kind: "admin",
      org_id: null,
      status: "active",
      email: fields.email,
      first_name: fields.firstName,
      last_name: fields.lastName,
      activated_at: new Date().toISOString(),
    });
    if (insertError) {
      throw new Error(
        `Profile row missing and fallback insert failed (${insertError.message}). ` +
          `Verify the handle_new_user trigger is installed.`,
      );
    }
    return;
  }

  if (row.kind !== "admin") {
    throw new Error(
      `Profile ${userId} exists with kind='${row.kind}', expected 'admin'. ` +
        `Refusing to converge a non-admin row.`,
    );
  }

  if (row.status !== "active") {
    const { error: updateError } = await admin
      .from("profiles")
      .update({ status: "active", activated_at: new Date().toISOString() })
      .eq("id", userId);
    if (updateError) {
      throw new Error(`Failed to activate admin profile: ${updateError.message}`);
    }
    console.log(`[seed-admins] repaired profile status → active`);
  }
}

main().catch((err: unknown) => {
  console.error(`[seed-admins] FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
