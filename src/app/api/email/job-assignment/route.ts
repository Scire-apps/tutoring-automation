import { json, readJson } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/email/job-assignment
 * Send job assignment notification to tutor.
 */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const data = await readJson<Record<string, any>>(req);

  // Validate required fields
  const requiredFields = ["tutor_email", "tutor_name", "job_details"];
  for (const field of requiredFields) {
    if (!(field in data)) {
      return json({ error: `Missing required field: ${field}` }, 400);
    }
  }

  const tutorEmail = data.tutor_email;
  const tutorName = data.tutor_name;
  const jobDetails = data.job_details;

  // Validate job details (support both legacy and new fields)
  const requiredJobFields = ["tutee_name", "location"];
  for (const field of requiredJobFields) {
    if (!(field in jobDetails)) {
      return json({ error: `Missing required job detail: ${field}` }, 400);
    }
  }

  // Normalize subject line from new triplet fields if provided
  const subjName = jobDetails.subject || jobDetails.subject_name || "Subject";
  const subjType = jobDetails.subject_type;
  const subjGrade = jobDetails.subject_grade;
  const fullSubject =
    subjType && subjGrade ? `${subjName} • ${subjType} • Grade ${subjGrade}` : subjName;

  // Create email content
  const subject = `New Tutoring Assignment: ${fullSubject}`;

  const htmlBody = `
    <html>
    <body>
        <h2>New Tutoring Assignment</h2>
        <p>Hello ${tutorName},</p>
        <p>Congratulations! You have been assigned a new tutoring opportunity:</p>
        <ul>
            <li><strong>Subject:</strong> ${fullSubject}</li>
            <li><strong>Student:</strong> ${jobDetails.tutee_name}</li>
            <li><strong>Location:</strong> ${jobDetails.location}</li>
        </ul>
        <p>Please log into the tutoring platform to schedule your session with the student.</p>
        <p>Remember to record your session and upload it to receive volunteer hours credit.</p>
        <p>Thank you for volunteering!</p>
    </body>
    </html>
    `;

  // Guard optional keys (subject/grade_level) to avoid crashes
  const textSubject = jobDetails.subject ?? subjName;
  const textGradeLevel = jobDetails.grade_level ?? "";
  const textBody = `
    New Tutoring Assignment

    Hello ${tutorName},

    Congratulations! You have been assigned a new tutoring opportunity:

    Subject: ${textSubject}
    Student: ${jobDetails.tutee_name}
    Grade Level: ${textGradeLevel}
    Location: ${jobDetails.location}

    Please log into the tutoring platform to schedule your session with the student.

    Remember to record your session and upload it to receive volunteer hours credit.

    Thank you for volunteering!
    `;

  // Send email
  const success = await sendEmail({ to: tutorEmail, subject, html: htmlBody, text: textBody });

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
          content: `Job assignment notification for ${textSubject}`,
          status: "sent",
        });
      }
    } catch (e) {
      console.error(`Failed to log communication: ${e}`);
    }

    return json({ message: "Job assignment notification sent successfully" }, 200);
  } else {
    return json({ error: "Failed to send job assignment notification" }, 500);
  }
}
