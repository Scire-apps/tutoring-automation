"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

let browserClient: SupabaseClient<Database> | undefined;

/**
 * Cookie-native browser Supabase client (@supabase/ssr). Sessions are stored in
 * cookies so the proxy and server layouts read the same auth state — this
 * replaces the deleted `src/services/supabase.ts` localStorage client and kills
 * the stale-cookie bug class (§3.5).
 *
 * Returns a singleton per browser tab; never instantiate `createBrowserClient`
 * directly in components.
 */
export function getBrowserClient(): SupabaseClient<Database> {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(SUPABASE_URL, ANON_KEY);
  }
  return browserClient;
}
