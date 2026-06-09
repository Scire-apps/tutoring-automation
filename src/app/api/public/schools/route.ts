export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { json } from "@/lib/http";

// GET /api/public/schools — api.py: list_schools_public
// PUBLIC (no auth). Anon client; schools is readable under public RLS.
export async function GET() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );

  const { data } = await supabase
    .from("schools")
    .select("id, name, domain")
    .order("name");

  return json({ schools: data || [] });
}
