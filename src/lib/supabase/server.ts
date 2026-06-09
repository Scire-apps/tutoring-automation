import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY as string;

if (!SUPABASE_URL || !ANON_KEY) {
  // Surface misconfiguration early in dev.
  console.warn("[supabase/server] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

/**
 * RLS-bound client for a specific authenticated user.
 *
 * Faithful to the old Flask backend (anon key + `postgrest.auth(jwt)`): the
 * caller's access token is attached to every PostgREST request so Postgres RLS
 * enforces per-user authorization. Use this for all normal user-facing routes.
 */
export function createUserClient(accessToken: string): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Service-role (secret key) client that BYPASSES RLS. Server-only.
 *
 * Use only where there is no user context or elevation is genuinely required:
 *  - the session-reminder cron (`/api/cron/send-reminders`)
 *  - privileged multi-table transitions where an RLS path is insufficient
 * Never import this from client code and never expose the key to the browser.
 */
export function createServiceClient(): SupabaseClient<Database> {
  if (!SECRET_KEY) {
    throw new Error("SUPABASE_SECRET_KEY is not configured");
  }
  return createClient<Database>(SUPABASE_URL, SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
