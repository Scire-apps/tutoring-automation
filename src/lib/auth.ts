import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createUserClient } from "@/lib/supabase/server";
import { getBearerToken, json } from "@/lib/http";

type AdminRow = Database["public"]["Tables"]["admins"]["Row"];

export type AuthOk = {
  ok: true;
  userId: string;
  email: string | null;
  token: string;
  supabase: SupabaseClient<Database>;
};

export type AuthFail = { ok: false; response: ReturnType<typeof json> };

export type AdminOk = AuthOk & { admin: AdminRow };

/**
 * Authenticate a request via its `Authorization: Bearer <jwt>` header.
 *
 * Returns a discriminated union. On success it includes an RLS-bound Supabase
 * client (`supabase`) for the caller. Usage in a route handler:
 *
 *   const auth = await requireAuth(req);
 *   if (!auth.ok) return auth.response;
 *   // ...use auth.userId / auth.email / auth.supabase
 */
export async function requireAuth(req: Request): Promise<AuthOk | AuthFail> {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, response: json({ error: "No authorization header provided" }, 401) };
  }
  const supabase = createUserClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    return { ok: false, response: json({ error: "Invalid token" }, 401) };
  }
  return { ok: true, userId: data.user.id, email: data.user.email ?? null, token, supabase };
}

/**
 * Authenticate AND require the caller to be an admin (row in `admins` by auth_id).
 * Mirrors the old Flask `@require_admin`. On success includes the admin row.
 */
export async function requireAdmin(req: Request): Promise<AdminOk | AuthFail> {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth;

  const { data, error } = await auth.supabase
    .from("admins")
    .select("*")
    .eq("auth_id", auth.userId)
    .single();

  if (error || !data) {
    return { ok: false, response: json({ error: "Access denied: Admin role required" }, 403) };
  }
  return { ...auth, admin: data as AdminRow };
}
