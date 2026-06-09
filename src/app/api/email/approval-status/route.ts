import { json, readJson } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reproduce Python str.title(): capitalize the first letter of each word. */
function titleCase(s: string): string {
  return s.replace(/[A-Za-z]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * POST /api/email/approval-status
 * Send subject approval status notification to tutor.
 */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const data = await readJson<Record<string, any>>(req);

  // Validate required fields
  const requiredFields = ["tutor_email", "tutor_name", "approval_details"];
  for (const field of requiredFields) {
    if (!(field in data)) {
      return json({ error: `Missing required field: ${field}` }, 400);
    }
  }

  const tutorEmail = data.tutor_email;
  const tutorName = data.tutor_name;
  const approvalDetails = data.approval_details;

  // Validate approval details
  const requiredApprovalFields = ["subject", "status", "admin_name"];
  for (const field of requiredApprovalFields) {
    if (!(field in approvalDetails)) {
      return json({ error: `Missing required approval detail: ${field}` }, 400);
    }
  }

  const status = approvalDetails.status;
  const subjectName = approvalDetails.subject;
  const adminName = approvalDetails.admin_name;

  let subject: string;
  let htmlBody: string;

  if (status === "approved") {
    subject = `Subject Approval: You're now approved for ${subjectName}`;
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
    subject = `Subject Approval Update: ${subjectName}`;
    htmlBody = `
        <html>
        <body>
            <h2>Subject Approval Update</h2>
            <p>Hello ${tutorName},</p>
            <p>We have reviewed your request to tutor <strong>${subjectName}</strong>.</p>
            <p>Status: <strong>${titleCase(String(status))}</strong></p>
            <p>Reviewed by: ${adminName}</p>
            <p>If you have questions about this decision, please contact your school administrator.</p>
            <p>Thank you for your interest in tutoring!</p>
        </body>
        </html>
        `;
  }

  // Send email
  const success = await sendEmail({ to: tutorEmail, subject, html: htmlBody });

  if (success) {
    return json({ message: "Approval status notification sent successfully" }, 200);
  } else {
    return json({ error: "Failed to send approval status notification" }, 500);
  }
}
