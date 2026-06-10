import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/http";
import type { PublicOrgsResponse } from "@/types/api";

/**
 * GET /api/public/orgs — anon-callable active-org list for signup/login
 * dropdowns (§7.2). Returns `{ items: [{ id, name }] }`, name-ascending.
 *
 * RLS (anon SELECT active orgs, id+name only) is the real filter; the query just
 * orders. Cached at the edge: `public, s-maxage=300, stale-while-revalidate=600`.
 */
export async function GET() {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    return serverError("server_error", "Failed to load organizations");
  }

  const body: PublicOrgsResponse = {
    items: (data ?? []).map((o) => ({ id: o.id, name: o.name })),
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
