import { json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ tutorId: string }> }
) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.response;
  const { tutorId } = await ctx.params;
  try {
    const data = await readJson<Record<string, any>>(req);
    const subjectId = data.subject_id; // deprecated
    const subjectName = String(data.subject_name || "").trim();
    const subjectType = String(data.subject_type || "").trim();
    const subjectGrade = String(data.subject_grade ?? "").trim();
    const action = data.action; // 'approve', 'reject', or 'remove'

    if (!action) {
      return json({ error: "action is required" }, 400);
    }

    if (action !== "remove") {
      if (!subjectName || !subjectType || !subjectGrade) {
        return json(
          { error: "subject_name, subject_type, subject_grade are required" },
          400
        );
      }
    }

    if (!["approve", "reject", "remove"].includes(action)) {
      return json({ error: "Invalid action" }, 400);
    }

    const supabase = a.supabase;

    // Get the admin ID from the authenticated user
    const { data: adminResult } = await supabase
      .from("admins")
      .select("id")
      .eq("auth_id", a.userId)
      .maybeSingle();
    if (!adminResult) {
      return json({ error: "Admin record not found" }, 403);
    }
    const adminId = (adminResult as any).id;

    // Fetch tutor basic info
    const { data: tutorRow } = await supabase
      .from("tutors")
      .select("first_name, last_name, email")
      .eq("id", tutorId)
      .maybeSingle();
    if (!tutorRow) {
      return json({ error: "Tutor not found" }, 404);
    }

    // Write into subject_approvals (embedded fields).
    try {
      if (action === "approve") {
        const { data: existing } = await supabase
          .from("subject_approvals")
          .select("id")
          .eq("tutor_id", tutorId)
          .eq("subject_name", subjectName)
          .eq("subject_type", subjectType)
          .eq("subject_grade", subjectGrade)
          .limit(1);
        const nowIso = new Date().toISOString();
        if (existing && existing.length > 0) {
          await supabase
            .from("subject_approvals")
            .update({
              status: "approved",
              approved_by: adminId,
              approved_at: nowIso,
            })
            .eq("tutor_id", tutorId)
            .eq("subject_name", subjectName)
            .eq("subject_type", subjectType)
            .eq("subject_grade", subjectGrade);
        } else {
          await supabase.from("subject_approvals").insert({
            tutor_id: tutorId,
            subject_name: subjectName,
            subject_type: subjectType,
            subject_grade: subjectGrade,
            status: "approved",
            approved_by: adminId,
            approved_at: nowIso,
          } as any);
        }
      } else {
        const { data: existing } = await supabase
          .from("subject_approvals")
          .select("id")
          .eq("tutor_id", tutorId)
          .eq("subject_name", subjectName)
          .eq("subject_type", subjectType)
          .eq("subject_grade", subjectGrade)
          .limit(1);
        if (existing && existing.length > 0) {
          if (action === "reject") {
            await supabase
              .from("subject_approvals")
              .update({
                status: "rejected",
                approved_by: adminId,
                approved_at: null,
              })
              .eq("tutor_id", tutorId)
              .eq("subject_name", subjectName)
              .eq("subject_type", subjectType)
              .eq("subject_grade", subjectGrade);
          } else {
            await supabase
              .from("subject_approvals")
              .delete()
              .eq("tutor_id", tutorId)
              .eq("subject_name", subjectName)
              .eq("subject_type", subjectType)
              .eq("subject_grade", subjectGrade);
          }
        }
      }
    } catch (e) {
      console.error("Subject approvals write failed:", e);
      return json(
        { error: "Failed to update subject approvals", details: String(e) },
        500
      );
    }

    // After approve or reject, delete matching certification request(s)
    if (action === "approve" || action === "reject") {
      try {
        const requestId = String(data.request_id || "").trim();
        if (requestId) {
          await supabase
            .from("certification_requests")
            .delete()
            .eq("id", requestId);
        } else {
          await supabase
            .from("certification_requests")
            .delete()
            .eq("tutor_id", tutorId)
            .eq("subject_name", subjectName)
            .eq("subject_type", subjectType)
            .eq("subject_grade", subjectGrade);
        }
      } catch (e) {
        console.warn(
          `Warning: failed to delete certification_requests for tutor ${tutorId} ${subjectName}/${subjectType}/${subjectGrade}:`,
          e
        );
      }
    }

    // Send email notification for approval/rejection (not for removal)
    if (action === "approve" || action === "reject") {
      try {
        const { data: adminDetails } = await supabase
          .from("admins")
          .select("first_name, last_name")
          .eq("id", adminId)
          .maybeSingle();

        if (tutorRow && adminDetails) {
          const tr = tutorRow as any;
          const ad = adminDetails as any;
          const tutorName = `${tr.first_name} ${tr.last_name}`;
          const adminName = `${ad.first_name} ${ad.last_name}`;

          let subjectLine: string;
          let htmlBody: string;
          if (action === "approve") {
            subjectLine = `Subject Approval: You're now approved for ${subjectName}`;
            htmlBody = `
                        <html>
                        <body>
                            <h2>Subject Approval Notification</h2>
                            <p>Hello ${tutorName},</p>
                            <p>Great news! You have been approved to tutor <strong>${subjectName}</strong>.</p>
                            <p>You can now apply for tutoring opportunities in this subject area.</p>
                            <p>Approved by: ${adminName}</p>
                            <p>Log into the tutoring platform to start browsing available opportunities!</p>
                            <p>Thank you for volunteering!</p>
                        </body>
                        </html>
                        `;
          } else {
            subjectLine = `Subject Approval Update: ${subjectName}`;
            htmlBody = `
                        <html>
                        <body>
                            <h2>Subject Approval Update</h2>
                            <p>Hello ${tutorName},</p>
                            <p>We have reviewed your request to tutor <strong>${subjectName}</strong>.</p>
                            <p>Status: <strong>Not Approved</strong></p>
                            <p>Reviewed by: ${adminName}</p>
                            <p>If you have questions about this decision, please contact your school administrator.</p>
                            <p>Thank you for your interest in tutoring!</p>
                        </body>
                        </html>
                        `;
          }

          await sendEmail({
            to: tr.email,
            subject: subjectLine,
            html: htmlBody,
          });
        }
      } catch (e) {
        console.error("Failed to send approval notification email:", e);
      }
    }

    return json(
      { message: `Subject approval ${action}d successfully`, subject_id: subjectId },
      200
    );
  } catch (e) {
    console.error("Error updating subject approvals:", e);
    return json({ error: "Internal server error", details: String(e) }, 500);
  }
}
