import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import type { PublicStatusResponse } from "@/types/api";

/**
 * GET /api/public/status — public, no-auth health check (§7.2, successor of the
 * deleted `/api/status`). Probes DB reachability via a trivial anon read and
 * reports `ok | degraded | down`. Never leaks configuration (that distinction is
 * the admin-only `/api/admin/status`).
 */
export async function GET() {
  let status: PublicStatusResponse["status"] = "ok";
  try {
    const supabase = createAnonClient();
    const { error } = await supabase
      .from("organizations")
      .select("id", { count: "exact", head: true });
    if (error) status = "degraded";
  } catch {
    status = "down";
  }

  const body: PublicStatusResponse = { status };
  return NextResponse.json(body, {
    status: status === "down" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
