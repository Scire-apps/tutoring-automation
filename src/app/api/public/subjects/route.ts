export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "@/lib/http";
import { subjectOptions } from "@/lib/subjects";

// GET /api/public/subjects — api.py: list_subjects_public
// PUBLIC (no auth). Master subject list (was subjects.txt) + fixed types/grades.
export async function GET() {
  return json(subjectOptions());
}
