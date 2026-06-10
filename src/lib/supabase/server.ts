import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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
 * Anonymous (anon key, no user token) client for public route handlers.
 *
 * RLS still applies — anon may only read what the anon policies allow (active
 * organizations' id+name for the signup/login dropdowns). Use for `/api/public/*`
 * endpoints that must work with no session.
 */
export function createAnonClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
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

/**
 * Cookie-backed @supabase/ssr server client for React Server Components and
 * server layouts (`getServerProfile()` reads through this for no-flash gating).
 *
 * The session lives in the request's auth cookies (set by the @supabase/ssr
 * browser client). Cookie writes are attempted but tolerated to fail: in a pure
 * RSC render context Next forbids mutating cookies, and the proxy already
 * refreshes/rotates them per request, so a no-op there is correct and safe.
 */
export async function createRSCClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // RSC render context: cookie mutation is not allowed. The proxy
          // refreshes the session cookie per request, so ignoring is safe.
        }
      },
    },
  });
}
