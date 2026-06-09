/**
 * Transactional email via the Mailjet REST API (v3.1), ported from the Flask
 * `MailjetEmailService`. All non-auth emails are sent directly here; Supabase
 * auth emails (signup/reset) go through Supabase's own SMTP config.
 */
import { scrubHdsbRoleTag } from "@/lib/domain";

const MAILJET_API_KEY = process.env.MAILJET_API_KEY || "";
const MAILJET_API_SECRET = process.env.MAILJET_API_SECRET || "";
const FROM_EMAIL = process.env.EMAIL_FROM || "";
const FROM_NAME = process.env.EMAIL_FROM_NAME || "Tutoring System";

/** Origin used to build dashboard links inside emails. */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
}

/** Send one email via Mailjet. Recipients are HDSB-scrubbed. Returns success. */
export async function sendEmail({ to, subject, html, text, cc }: SendEmailInput): Promise<boolean> {
  if (!MAILJET_API_KEY || !MAILJET_API_SECRET || !FROM_EMAIL) {
    console.error("[email] Mailjet not configured (MAILJET_API_KEY/SECRET/EMAIL_FROM)");
    return false;
  }
  const toClean = (scrubHdsbRoleTag(to) as string) || to;
  const ccClean = (cc || []).map((c) => (scrubHdsbRoleTag(c) as string) || c);

  const message: Record<string, unknown> = {
    From: { Email: FROM_EMAIL, Name: FROM_NAME },
    To: [{ Email: toClean }],
    Subject: subject,
    HTMLPart: html,
  };
  if (text) message.TextPart = text;
  if (ccClean.length) message.Cc = ccClean.map((email) => ({ Email: email }));

  try {
    const auth = "Basic " + Buffer.from(`${MAILJET_API_KEY}:${MAILJET_API_SECRET}`).toString("base64");
    const res = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({ Messages: [message] }),
    });
    if (res.status === 200) return true;
    console.error(`[email] Mailjet error ${res.status}: ${await res.text().catch(() => "")}`);
    return false;
  } catch (e) {
    console.error("[email] send failed:", e);
    return false;
  }
}

export interface SessionDetails {
  subject?: string;
  date?: string;
  time?: string;
  location?: string;
  tutor_name?: string;
  tutee_name?: string;
  tutee_grade?: string | null;
  duration_minutes?: number;
}

/** Confirmation emails to both tutor and tutee once a session is scheduled. */
export async function sendSessionConfirmation(
  tutorEmail: string,
  tuteeEmail: string,
  d: SessionDetails
): Promise<boolean> {
  const subjectName = d.subject || "";
  const date = d.date || "";
  const time = d.time || "";
  const location = d.location || "";
  const tutorName = d.tutor_name || "";
  const tuteeName = d.tutee_name || "";
  const tuteeGrade = d.tutee_grade || "";
  const duration = d.duration_minutes ?? 60;
  const subject = `Tutoring Session Confirmation: ${subjectName} on ${date}`;

  const tutorEmailClean = (scrubHdsbRoleTag(tutorEmail) as string) || tutorEmail;
  const tuteeEmailClean = (scrubHdsbRoleTag(tuteeEmail) as string) || tuteeEmail;
  const gradeSuffix = tuteeGrade ? ` (Grade ${tuteeGrade})` : "";

  const tutorHtml = `
  <html><body>
    <h2>Tutoring Session Confirmation</h2>
    <p>Hello ${tutorName},</p>
    <p>Your tutoring session has been confirmed with the following details:</p>
    <ul>
      <li><strong>Subject:</strong> ${subjectName}</li>
      <li><strong>Date:</strong> ${date}</li>
      <li><strong>Time:</strong> ${time}</li>
      <li><strong>Duration:</strong> ${duration} minutes</li>
      <li><strong>Location:</strong> ${location}</li>
      <li><strong>Student:</strong> ${tuteeName}${gradeSuffix}</li>
      <li><strong>Student Email:</strong> ${tuteeEmailClean}</li>
    </ul>
    <p>Please remember to record your session and upload it to the platform to receive volunteer hours credit.</p>
    <p>If you need to cancel or reschedule, please do so at least 24 hours in advance through the tutoring platform.</p>
    <p>Thank you for volunteering!</p>
  </body></html>`;
  const tutorText = `Tutoring Session Confirmation\n\nHello ${tutorName},\n\nYour tutoring session has been confirmed:\n\nSubject: ${subjectName}\nDate: ${date}\nTime: ${time}\nDuration: ${duration} minutes\nLocation: ${location}\nStudent: ${tuteeName}${gradeSuffix}\nStudent Email: ${tuteeEmailClean}\n\nPlease remember to record your session and upload it to the platform to receive volunteer hours credit.\n\nThank you for volunteering!`;

  const tuteeHtml = `
  <html><body>
    <h2>Tutoring Session Confirmation</h2>
    <p>Hello ${tuteeName},</p>
    <p>Your tutoring session has been confirmed with the following details:</p>
    <ul>
      <li><strong>Subject:</strong> ${subjectName}</li>
      <li><strong>Date:</strong> ${date}</li>
      <li><strong>Time:</strong> ${time}</li>
      <li><strong>Duration:</strong> ${duration} minutes</li>
      <li><strong>Location:</strong> ${location}</li>
      <li><strong>Tutor:</strong> ${tutorName}</li>
    </ul>
    <p>If you need to cancel or reschedule, please contact your tutor directly at ${tutorEmailClean}.</p>
    <p>We hope you have a productive tutoring session!</p>
  </body></html>`;
  const tuteeText = `Tutoring Session Confirmation\n\nHello ${tuteeName},\n\nYour tutoring session has been confirmed:\n\nSubject: ${subjectName}\nDate: ${date}\nTime: ${time}\nDuration: ${duration} minutes\nLocation: ${location}\nTutor: ${tutorName}\n\nIf you need to cancel or reschedule, please contact your tutor directly at ${tutorEmailClean}.\n\nWe hope you have a productive tutoring session!`;

  const a = await sendEmail({ to: tutorEmailClean, subject, html: tutorHtml, text: tutorText });
  const b = await sendEmail({ to: tuteeEmailClean, subject, html: tuteeHtml, text: tuteeText });
  return a && b;
}

/** Notify tutee that a tutor applied and they should set availability. */
export async function sendAvailabilityNotification(
  tuteeEmail: string,
  tuteeName: string,
  tutorName: string,
  subjectName: string,
  dashboardUrl: string
): Promise<boolean> {
  const subject = `Tutor Found for ${subjectName} - Please Set Your Availability`;
  const html = `
  <html><body>
    <h2>Great News! A Tutor Has Applied for Your Request</h2>
    <p>Hello ${tuteeName},</p>
    <p>We're excited to let you know that a tutor has applied for your tutoring request in <strong>${subjectName}</strong>!</p>
    <h3>Next Steps:</h3>
    <ol>
      <li>Log into your tutoring dashboard</li>
      <li>Set your availability for the upcoming week</li>
      <li>The tutor will then finalize the schedule based on your preferences</li>
    </ol>
    <p><strong>Tutor:</strong> ${tutorName}</p>
    <p><strong>Subject:</strong> ${subjectName}</p>
    <div style="margin: 30px 0; text-align: center;">
      <a href="${dashboardUrl}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Set Your Availability</a>
    </div>
    <p><strong>Important:</strong> Please set your availability ASAP.</p>
    <p>Best regards,<br>The Tutoring Team</p>
  </body></html>`;
  const text = `Great News! A Tutor Has Applied for Your Request\n\nHello ${tuteeName},\n\nA tutor has applied for your tutoring request in ${subjectName}!\n\nNext Steps:\n1. Log into your tutoring dashboard\n2. Set your availability for the upcoming week\n3. The tutor will then finalize the schedule\n\nTutor: ${tutorName}\nSubject: ${subjectName}\n\nSet Your Availability: ${dashboardUrl}\n\nBest regards,\nThe Tutoring Team`;
  return sendEmail({ to: tuteeEmail, subject, html, text });
}

/** Notify tutor that the tutee set availability and they should schedule. */
export async function sendTutorSchedulingNotification(
  tutorEmail: string,
  tutorName: string,
  tuteeName: string,
  subjectName: string,
  dashboardUrl: string
): Promise<boolean> {
  const subject = `Student Has Set Availability for ${subjectName} - Please Schedule Session`;
  const html = `
  <html><body>
    <h2>Great! Your Student Has Set Their Availability</h2>
    <p>Hello ${tutorName},</p>
    <p>Your student has set their availability for your tutoring session in <strong>${subjectName}</strong>.</p>
    <h3>Next Steps:</h3>
    <ol>
      <li>Log into your tutoring dashboard</li>
      <li>Review the student's available time slots</li>
      <li>Choose the best time that works for both of you</li>
      <li>Confirm the session schedule</li>
    </ol>
    <p><strong>Student:</strong> ${tuteeName}</p>
    <p><strong>Subject:</strong> ${subjectName}</p>
    <div style="margin: 30px 0; text-align: center;">
      <a href="${dashboardUrl}" style="background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Schedule Session</a>
    </div>
    <p><strong>Important:</strong> Please schedule the session ASAP.</p>
    <p>Thank you for volunteering!<br>The Tutoring Team</p>
  </body></html>`;
  const text = `Great! Your Student Has Set Their Availability\n\nHello ${tutorName},\n\nYour student has set their availability for ${subjectName}.\n\nNext Steps:\n1. Log into your tutoring dashboard\n2. Review the student's available time slots\n3. Choose the best time\n4. Confirm the session schedule\n\nStudent: ${tuteeName}\nSubject: ${subjectName}\n\nSchedule Session: ${dashboardUrl}\n\nThank you for volunteering!\nThe Tutoring Team`;
  return sendEmail({ to: tutorEmail, subject, html, text });
}

export interface ReminderDetails {
  subject: string;
  date: string;
  time: string;
  location: string;
  tutor_name: string;
  tutee_name: string;
}

/** "Session tomorrow" reminder to the tutor. */
export async function sendTutorReminder(tutorEmail: string, d: ReminderDetails): Promise<boolean> {
  if (!tutorEmail) return false;
  const subject = `Reminder: Tutoring Session Tomorrow - ${d.subject}`;
  const html = `
  <html><body>
    <h2>Session Reminder</h2>
    <p>Hello ${d.tutor_name},</p>
    <p>This is a friendly reminder about your tutoring session tomorrow:</p>
    <ul>
      <li><strong>Subject:</strong> ${d.subject}</li>
      <li><strong>Date:</strong> ${d.date}</li>
      <li><strong>Time:</strong> ${d.time}</li>
      <li><strong>Location:</strong> ${d.location}</li>
      <li><strong>Student:</strong> ${d.tutee_name}</li>
    </ul>
    <p>Please remember to record your session for volunteer hours credit.</p>
    <p>Thank you for volunteering!</p>
  </body></html>`;
  const text = `Session Reminder\n\nHello ${d.tutor_name},\n\nReminder about your tutoring session tomorrow:\n\nSubject: ${d.subject}\nDate: ${d.date}\nTime: ${d.time}\nLocation: ${d.location}\nStudent: ${d.tutee_name}\n\nThank you for volunteering!`;
  return sendEmail({ to: tutorEmail, subject, html, text });
}

/** "Session tomorrow" reminder to the tutee. */
export async function sendTuteeReminder(tuteeEmail: string, d: ReminderDetails): Promise<boolean> {
  if (!tuteeEmail) return false;
  const subject = `Reminder: Tutoring Session Tomorrow - ${d.subject}`;
  const html = `
  <html><body>
    <h2>Session Reminder</h2>
    <p>Hello ${d.tutee_name},</p>
    <p>This is a friendly reminder about your tutoring session tomorrow:</p>
    <ul>
      <li><strong>Subject:</strong> ${d.subject}</li>
      <li><strong>Date:</strong> ${d.date}</li>
      <li><strong>Time:</strong> ${d.time}</li>
      <li><strong>Location:</strong> ${d.location}</li>
      <li><strong>Tutor:</strong> ${d.tutor_name}</li>
    </ul>
    <p>We hope you have a productive session!</p>
  </body></html>`;
  const text = `Session Reminder\n\nHello ${d.tutee_name},\n\nReminder about your tutoring session tomorrow:\n\nSubject: ${d.subject}\nDate: ${d.date}\nTime: ${d.time}\nLocation: ${d.location}\nTutor: ${d.tutor_name}\n\nWe hope you have a productive session!`;
  return sendEmail({ to: tuteeEmail, subject, html, text });
}

export { scrubHdsbRoleTag };
