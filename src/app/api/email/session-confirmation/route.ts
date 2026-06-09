import { json, readJson } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidEmail(addr: unknown): addr is string {
  return (
    typeof addr === "string" &&
    addr.includes("@") &&
    addr.split("@").slice(-1)[0].includes(".")
  );
}

/**
 * POST /api/email/session-confirmation
 * Send session confirmation emails to tutor and tutee.
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

  const tutorEmailInput = data.tutor_email;
  let tuteeEmail = data.tutee_email;
  const sessionDetails = data.session_details;

  // Validate session details - only support single session (date/time)
  const requiredBasicFields = ["subject", "location", "tutor_name", "tutee_name", "date", "time"];
  for (const field of requiredBasicFields) {
    if (!(field in sessionDetails)) {
      return json({ error: `Missing required session detail: ${field}` }, 400);
    }
  }

  // Resolve missing/invalid recipient emails using job context when possible
  const jobId = data.job_id;
  if (!isValidEmail(tuteeEmail) && jobId) {
    try {
      const { data: jobRes } = await auth.supabase
        .from("tutoring_jobs")
        .select("tutee_id")
        .eq("id", jobId)
        .maybeSingle();
      if (jobRes && jobRes.tutee_id) {
        const { data: tuteeRes } = await auth.supabase
          .from("tutees")
          .select("email")
          .eq("id", jobRes.tutee_id)
          .maybeSingle();
        if (tuteeRes && isValidEmail(tuteeRes.email)) {
          tuteeEmail = tuteeRes.email;
        }
      }
    } catch (e) {
      console.warn(`Failed to resolve tutee email for job ${jobId}: ${e}`);
    }
  }

  const tutorEmail = tutorEmailInput;
  if (!isValidEmail(tutorEmail)) {
    return json({ error: "Invalid tutor_email" }, 400);
  }
  if (!isValidEmail(tuteeEmail)) {
    return json({ error: "Invalid tutee_email" }, 400);
  }

  // Build HTML/text bodies for single session
  const subjText = sessionDetails.subject;
  const location = sessionDetails.location;
  const tutorName = sessionDetails.tutor_name;
  const tuteeName = sessionDetails.tutee_name;
  const date = sessionDetails.date;
  const time = sessionDetails.time;

  const html = `
    <html><body>
    <h2>Session Confirmation</h2>
    <p>Hello ${tutorName} and ${tuteeName},</p>
    <p>Your tutoring session has been scheduled for <strong>${subjText}</strong> on <strong>${date}</strong> at <strong>${time}</strong> at <strong>${location}</strong>.</p>
    <p>Thank you!</p>
    </body></html>
    `;
  const text = `Session Confirmation for ${subjText} on ${date} at ${time} (${location})`;

  // Send emails to both parties (in sequence)
  const tutorOk = await sendEmail({ to: tutorEmail, subject: `Session Confirmation: ${subjText}`, html, text });
  const tuteeOk = tutorOk && (await sendEmail({ to: tuteeEmail, subject: `Session Confirmation: ${subjText}`, html, text }));
  const success = tutorOk && tuteeOk;

  if (success) {
    // Log the communication in the database (best-effort)
    try {
      if (jobId) {
        const contentText = `Session confirmation for ${subjText} on ${date} at ${time} (${location})`;
        await auth.supabase.from("communications").insert({
          job_id: jobId,
          type: "email",
          recipient: tutorEmail,
          subject: `Session confirmation for ${subjText}`,
          content: contentText,
          status: "sent",
        });
        await auth.supabase.from("communications").insert({
          job_id: jobId,
          type: "email",
          recipient: tuteeEmail,
          subject: `Session confirmation for ${subjText}`,
          content: contentText,
          status: "sent",
        });
      }
    } catch (e) {
      console.error(`Failed to log communication: ${e}`);
    }

    return json({ message: "Session confirmation emails sent successfully" }, 200);
  } else {
    return json(
      { error: "Failed to send session confirmation emails", tutor_sent: tutorOk, tutee_sent: tuteeOk },
      500
    );
  }
}
