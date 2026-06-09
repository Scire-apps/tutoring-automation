export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "@/lib/http";

// GET /api/status — api.py: status
export async function GET() {
  return json({
    status: "operational",
    version: "1.0.0",
  });
}
