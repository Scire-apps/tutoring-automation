import { json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { SUBJECTS, SUBJECT_TYPES, GRADES } from "@/lib/subjects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.response;
  try {
    const namesPayload = SUBJECTS.map((n) => ({
      name: n ? n[0].toUpperCase() + n.slice(1) : n,
    }));
    return json(
      {
        subjects: namesPayload,
        types: [...SUBJECT_TYPES],
        grades: [...GRADES],
      },
      200
    );
  } catch {
    return json(
      { subjects: [], types: [...SUBJECT_TYPES], grades: [...GRADES] },
      200
    );
  }
}
