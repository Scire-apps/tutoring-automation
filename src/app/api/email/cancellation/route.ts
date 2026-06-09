import { json, readJson } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/email/cancellation
 * Send cancellation notification emails to tutor and tutee.
 */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const data = await readJson<Record<string, any>>(req);

  // Validate required fields
  const requiredFields = ["tutor_email", "tutee_email", "cancellation_details"];
  for (const field of requiredFields) {
    if (!(field in data)) {
      return json({ error: `Missing required field: ${field}` }, 400);
    }
  }

  const tutorEmail = data.tutor_email;
  const tuteeEmail = data.tutee_email;
  const cancellationDetails = data.cancellation_details;

  // Validate cancellation details
  const requiredCancellationFields = ["subject", "tutor_name", "tutee_name", "reason"];
  for (const field of requiredCancellationFields) {
    if (!(field in cancellationDetails)) {
      return json({ error: `Missing required cancellation detail: ${field}` }, 400);
    }
  }

  const subject = `Tutoring Session Cancelled: ${cancellationDetails.subject}`;

  // Create email content for tutor
  const tutorHtml = `
    <html>
    <body>
        <h2>Tutoring Session Cancelled</h2>
        <p>Hello ${cancellationDetails.tutor_name},</p>
        <p>Your tutoring session has been cancelled:</p>
        <ul>
            <li><strong>Subject:</strong> ${cancellationDetails.subject}</li>
            <li><strong>Student:</strong> ${cancellationDetails.tutee_name}</li>
            <li><strong>Reason:</strong> ${cancellationDetails.reason}</li>
        </ul>
        <p>The opportunity has been returned to the tutoring board for other tutors to apply.</p>
        <p>Thank you for your understanding.</p>
    </body>
    </html>
    `;

  // Create email content for tutee
  const tuteeHtml = `
    <html>
    <body>
        <h2>Tutoring Session Cancelled</h2>
        <p>Hello ${cancellationDetails.tutee_name},</p>
        <p>Unfortunately, your tutoring session has been cancelled:</p>
        <ul>
            <li><strong>Subject:</strong> ${cancellationDetails.subject}</li>
            <li><strong>Tutor:</strong> ${cancellationDetails.tutor_name}</li>
            <li><strong>Reason:</strong> ${cancellationDetails.reason}</li>
        </ul>
        <p>Don't worry - your request has been returned to our system and another qualified tutor will be able to help you soon.</p>
        <p>You will receive a new confirmation email once a tutor is assigned.</p>
        <p>We apologize for any inconvenience.</p>
    </body>
    </html>
    `;

  // Send emails
  const tutorSuccess = await sendEmail({ to: tutorEmail, subject, html: tutorHtml });
  const tuteeSuccess = await sendEmail({ to: tuteeEmail, subject, html: tuteeHtml });

  const success = tutorSuccess && tuteeSuccess;

  if (success) {
    // Log the communication (best-effort)
    try {
      const jobId = data.job_id;
      if (jobId) {
        await auth.supabase.from("communications").insert({
          job_id: jobId,
          type: "email",
          recipient: tutorEmail,
          subject,
          content: `Cancellation notification for ${cancellationDetails.subject} - ${cancellationDetails.reason}`,
          status: "sent",
        });
        await auth.supabase.from("communications").insert({
          job_id: jobId,
          type: "email",
          recipient: tuteeEmail,
          subject,
          content: `Cancellation notification for ${cancellationDetails.subject} - ${cancellationDetails.reason}`,
          status: "sent",
        });
      }
    } catch (e) {
      console.error(`Failed to log communication: ${e}`);
    }

    return json({ message: "Cancellation notifications sent successfully" }, 200);
  } else {
    return json({ error: "Failed to send cancellation notifications" }, 500);
  }
}
