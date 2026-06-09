import { json, readJson } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/email/reminder
 * Send session reminder emails to tutor and tutee.
 */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const data = await readJson<Record<string, any>>(req);

  // Validate required fields
  const requiredFields = ["tutor_email", "tutee_email", "session_details"];
  for (const field of requiredFields) {
    if (!(field in data)) {
      return json({ error: `Missing required field: ${field}` }, 400);
    }
  }

  const tutorEmail = data.tutor_email;
  const tuteeEmail = data.tutee_email;
  const sessionDetails = data.session_details;

  // Validate session details
  const requiredSessionFields = ["subject", "date", "time", "location", "tutor_name", "tutee_name"];
  for (const field of requiredSessionFields) {
    if (!(field in sessionDetails)) {
      return json({ error: `Missing required session detail: ${field}` }, 400);
    }
  }

  const subject = `Reminder: Tutoring Session Tomorrow - ${sessionDetails.subject}`;

  // Create email content for tutor
  const tutorHtml = `
    <html>
    <body>
        <h2>Session Reminder</h2>
        <p>Hello ${sessionDetails.tutor_name},</p>
        <p>This is a friendly reminder about your tutoring session tomorrow:</p>
        <ul>
            <li><strong>Subject:</strong> ${sessionDetails.subject}</li>
            <li><strong>Date:</strong> ${sessionDetails.date}</li>
            <li><strong>Time:</strong> ${sessionDetails.time}</li>
            <li><strong>Location:</strong> ${sessionDetails.location}</li>
            <li><strong>Student:</strong> ${sessionDetails.tutee_name}</li>
        </ul>
        <p>Please remember to:</p>
        <ul>
            <li>Arrive on time and prepared</li>
            <li>Record your session for volunteer hours credit</li>
            <li>Contact the student if you need to make any changes</li>
        </ul>
        <p>Thank you for volunteering!</p>
    </body>
    </html>
    `;

  // Create email content for tutee
  const tuteeHtml = `
    <html>
    <body>
        <h2>Session Reminder</h2>
        <p>Hello ${sessionDetails.tutee_name},</p>
        <p>This is a friendly reminder about your tutoring session tomorrow:</p>
        <ul>
            <li><strong>Subject:</strong> ${sessionDetails.subject}</li>
            <li><strong>Date:</strong> ${sessionDetails.date}</li>
            <li><strong>Time:</strong> ${sessionDetails.time}</li>
            <li><strong>Location:</strong> ${sessionDetails.location}</li>
            <li><strong>Tutor:</strong> ${sessionDetails.tutor_name}</li>
        </ul>
        <p>Please remember to:</p>
        <ul>
            <li>Arrive on time and bring any materials you need</li>
            <li>Come prepared with specific questions or topics</li>
            <li>Contact your tutor if you need to make any changes</li>
        </ul>
        <p>We hope you have a productive session!</p>
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
          content: `Session reminder for ${sessionDetails.subject} on ${sessionDetails.date}`,
          status: "sent",
        });
        await auth.supabase.from("communications").insert({
          job_id: jobId,
          type: "email",
          recipient: tuteeEmail,
          subject,
          content: `Session reminder for ${sessionDetails.subject} on ${sessionDetails.date}`,
          status: "sent",
        });
      }
    } catch (e) {
      console.error(`Failed to log communication: ${e}`);
    }

    return json({ message: "Session reminders sent successfully" }, 200);
  } else {
    return json({ error: "Failed to send session reminders" }, 500);
  }
}
