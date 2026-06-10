/**
 * Transactional email for Scire (§7.7). Mailjet REST core; every send is logged
 * to `email_log` via the service-confined `logEmail` (§2.6). When
 * `EMAIL_DRY_RUN=1` nothing is dispatched — the message is logged to the console
 * and recorded as `sent` so smokes can assert without hitting Mailjet.
 *
 * Recipients are always resolved from DB rows by callers, never request bodies
 * (§2.7). Sign-off is "The Scire Team"; every message carries the BRAND footer.
 * Callers wrap sends in `next/server` `after(() => …)` so responses never block.
 */
import { BRAND } from "@/lib/brand";
import { logEmail } from "@/lib/log";

const MAILJET_API_KEY = process.env.MAILJET_API_KEY || "";
const MAILJET_API_SECRET = process.env.MAILJET_API_SECRET || "";
const FROM_EMAIL = process.env.EMAIL_FROM || "";
const FROM_NAME = process.env.EMAIL_FROM_NAME || BRAND.emailFromName;
const DRY_RUN = process.env.EMAIL_DRY_RUN === "1";

/** Origin used to build absolute links inside emails. */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

/** Escape user-supplied text before interpolating into HTML (broadcast bodies, notes). */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// --- Shared layout -----------------------------------------------------------

const BTN_BLUE = "#2563eb"; // blue-600
const BTN_GREEN = "#10b981";

function button(href: string, label: string, color = BTN_BLUE): string {
  return `<div style="margin:28px 0;text-align:center;">
    <a href="${href}" style="background-color:${color};color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">${label}</a>
  </div>`;
}

/**
 * Wrap inner HTML in the standard Scire shell: brand wordmark header + the
 * "The Scire Team" sign-off and contact footer. `footerExtra` appends an
 * attribution line (broadcasts).
 */
function layout(innerHtml: string, footerExtra?: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="font-size:22px;font-weight:700;color:${BTN_BLUE};margin-bottom:24px;">${BRAND.name}</div>
    <div style="background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
      ${innerHtml}
      <p style="margin-top:28px;color:#0f172a;">— The ${BRAND.name} Team</p>
    </div>
    <div style="margin-top:20px;font-size:12px;color:#64748b;line-height:1.6;">
      ${footerExtra ? `${footerExtra}<br/>` : ""}
      Questions? Email <a href="mailto:${BRAND.contactEmail}" style="color:${BTN_BLUE};">${BRAND.contactEmail}</a>.
    </div>
  </div>
  </body></html>`;
}

/** Plain-text counterpart of the footer (appended to every text body). */
function textFooter(footerExtra?: string): string {
  return `\n\n— The ${BRAND.name} Team\n${footerExtra ? footerExtra + "\n" : ""}Questions? Email ${BRAND.contactEmail}.`;
}

// --- Core send ---------------------------------------------------------------

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  /** email_log annotations (kind, org, attribution, batch grouping). */
  log?: {
    kind?: string | null;
    org_id?: string | null;
    sender_id?: string | null;
    recipient_id?: string | null;
    session_id?: string | null;
    batch_id?: string | null;
  };
}

/**
 * Send one email via Mailjet and record an `email_log` row. Under
 * `EMAIL_DRY_RUN=1` the dispatch is skipped (console-logged) and logged as
 * `sent`. Returns whether the message was accepted for delivery.
 */
export async function sendEmail({ to, subject, html, text, cc, log }: SendEmailInput): Promise<boolean> {
  let ok = false;

  if (DRY_RUN) {
    console.log(`[email:dry-run] to=${to} subject=${JSON.stringify(subject)}`);
    ok = true;
  } else if (!MAILJET_API_KEY || !MAILJET_API_SECRET || !FROM_EMAIL) {
    console.error("[email] Mailjet not configured (MAILJET_API_KEY/SECRET/EMAIL_FROM)");
    ok = false;
  } else {
    const message: Record<string, unknown> = {
      From: { Email: FROM_EMAIL, Name: FROM_NAME },
      To: [{ Email: to }],
      Subject: subject,
      HTMLPart: html,
    };
    if (text) message.TextPart = text;
    if (cc && cc.length) message.Cc = cc.map((email) => ({ Email: email }));

    try {
      const auth = "Basic " + Buffer.from(`${MAILJET_API_KEY}:${MAILJET_API_SECRET}`).toString("base64");
      const res = await fetch("https://api.mailjet.com/v3.1/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify({ Messages: [message] }),
      });
      ok = res.status === 200;
      if (!ok) console.error(`[email] Mailjet error ${res.status}: ${await res.text().catch(() => "")}`);
    } catch (e) {
      console.error("[email] send failed:", e);
      ok = false;
    }
  }

  await logEmail({
    recipient_email: to,
    subject,
    status: ok ? "sent" : "failed",
    body: text ?? null,
    kind: log?.kind ?? null,
    org_id: log?.org_id ?? null,
    sender_id: log?.sender_id ?? null,
    recipient_id: log?.recipient_id ?? null,
    session_id: log?.session_id ?? null,
    batch_id: log?.batch_id ?? null,
  });

  return ok;
}

// --- Template helper shapes --------------------------------------------------

type Recipient = { email: string; name: string; id?: string | null };
type SessionContext = {
  org_id?: string | null;
  session_id?: string | null;
  subjectName: string;
};

// --- Templates (~12) ---------------------------------------------------------

/** Tutor claimed a request → notify the requester to set availability. */
export function claimNotification(
  requester: Recipient,
  tutorName: string,
  ctx: SessionContext,
  availabilityUrl: string,
): Promise<boolean> {
  const subject = `A tutor claimed your ${ctx.subjectName} request`;
  const inner = `<h2 style="margin-top:0;">A tutor is ready to help</h2>
    <p>Hi ${requester.name},</p>
    <p><strong>${tutorName}</strong> claimed your tutoring request for <strong>${ctx.subjectName}</strong>. The next step is to set your availability so they can schedule a time.</p>
    ${button(availabilityUrl, "Set your availability")}`;
  const text = `A tutor is ready to help\n\nHi ${requester.name},\n\n${tutorName} claimed your tutoring request for ${ctx.subjectName}. Set your availability so they can schedule a time:\n${availabilityUrl}${textFooter()}`;
  return sendEmail({
    to: requester.email,
    subject,
    html: layout(inner),
    text,
    log: { kind: "claim_notification", org_id: ctx.org_id, session_id: ctx.session_id, recipient_id: requester.id ?? null },
  });
}

/** Requester set availability → notify the tutor to schedule. */
export function availabilitySet(
  tutor: Recipient,
  requesterName: string,
  ctx: SessionContext,
  scheduleUrl: string,
): Promise<boolean> {
  const subject = `${requesterName} set their availability for ${ctx.subjectName}`;
  const inner = `<h2 style="margin-top:0;">Time to schedule</h2>
    <p>Hi ${tutor.name},</p>
    <p><strong>${requesterName}</strong> set their availability for your <strong>${ctx.subjectName}</strong> session. Pick a time that fits within their windows.</p>
    ${button(scheduleUrl, "Schedule the session", BTN_GREEN)}`;
  const text = `Time to schedule\n\nHi ${tutor.name},\n\n${requesterName} set their availability for your ${ctx.subjectName} session. Pick a time:\n${scheduleUrl}${textFooter()}`;
  return sendEmail({
    to: tutor.email,
    subject,
    html: layout(inner),
    text,
    log: { kind: "availability_set", org_id: ctx.org_id, session_id: ctx.session_id, recipient_id: tutor.id ?? null },
  });
}

export type SessionScheduleDetails = {
  subjectName: string;
  date: string;
  time: string;
  location: string;
  durationMinutes: number;
};

/** Session scheduled → confirmation to both parties. Returns true iff both sent. */
export async function sessionConfirmation(
  tutor: Recipient,
  requester: Recipient,
  d: SessionScheduleDetails,
  ctx: { org_id?: string | null; session_id?: string | null } = {},
): Promise<boolean> {
  const subject = `Confirmed: ${d.subjectName} on ${d.date}`;
  const detailRows = `<ul style="line-height:1.8;">
      <li><strong>Subject:</strong> ${d.subjectName}</li>
      <li><strong>Date:</strong> ${d.date}</li>
      <li><strong>Time:</strong> ${d.time}</li>
      <li><strong>Duration:</strong> ${d.durationMinutes} minutes</li>
      <li><strong>Location:</strong> ${d.location}</li>
    </ul>`;

  const tutorInner = `<h2 style="margin-top:0;">Your session is confirmed</h2>
    <p>Hi ${tutor.name},</p>
    <p>You're scheduled to tutor <strong>${requester.name}</strong>:</p>
    ${detailRows}
    <p>Remember to record the session and add the recording link so your volunteer hours can be verified.</p>`;
  const tutorText = `Your session is confirmed\n\nHi ${tutor.name},\n\nYou're scheduled to tutor ${requester.name}.\nSubject: ${d.subjectName}\nDate: ${d.date}\nTime: ${d.time}\nDuration: ${d.durationMinutes} minutes\nLocation: ${d.location}\n\nRemember to record the session and add the recording link so your hours can be verified.${textFooter()}`;

  const requesterInner = `<h2 style="margin-top:0;">Your session is confirmed</h2>
    <p>Hi ${requester.name},</p>
    <p><strong>${tutor.name}</strong> will be tutoring you:</p>
    ${detailRows}`;
  const requesterText = `Your session is confirmed\n\nHi ${requester.name},\n\n${tutor.name} will be tutoring you.\nSubject: ${d.subjectName}\nDate: ${d.date}\nTime: ${d.time}\nDuration: ${d.durationMinutes} minutes\nLocation: ${d.location}${textFooter()}`;

  const a = await sendEmail({
    to: tutor.email,
    subject,
    html: layout(tutorInner),
    text: tutorText,
    log: { kind: "session_confirmation", org_id: ctx.org_id, session_id: ctx.session_id, recipient_id: tutor.id ?? null },
  });
  const b = await sendEmail({
    to: requester.email,
    subject,
    html: layout(requesterInner),
    text: requesterText,
    log: { kind: "session_confirmation", org_id: ctx.org_id, session_id: ctx.session_id, recipient_id: requester.id ?? null },
  });
  return a && b;
}

/**
 * Session cancelled or reopened by a manager → notify a party. `reason` is
 * shown verbatim. `reopened` switches the copy between "cancelled" and
 * "released back to the board".
 */
export function sessionCancelled(
  recipient: Recipient,
  ctx: SessionContext,
  reason: string,
  opts: { reopened?: boolean; byManager?: boolean } = {},
): Promise<boolean> {
  const verbed = opts.reopened ? "reopened" : "cancelled";
  const subject = opts.reopened
    ? `Your ${ctx.subjectName} session was reopened`
    : `Your ${ctx.subjectName} session was cancelled`;
  const lead = opts.reopened
    ? `Your <strong>${ctx.subjectName}</strong> session was reopened and returned to the tutoring board. A tutor can claim it again.`
    : `Your <strong>${ctx.subjectName}</strong> session was cancelled${opts.byManager ? " by your organization" : ""}.`;
  const inner = `<h2 style="margin-top:0;">Session ${verbed}</h2>
    <p>Hi ${recipient.name},</p>
    <p>${lead}</p>
    ${reason ? `<p style="background:#f1f5f9;border-radius:8px;padding:12px;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ""}`;
  const text = `Session ${verbed}\n\nHi ${recipient.name},\n\n${opts.reopened ? `Your ${ctx.subjectName} session was reopened and returned to the board.` : `Your ${ctx.subjectName} session was cancelled${opts.byManager ? " by your organization" : ""}.`}${reason ? `\n\nReason: ${reason}` : ""}${textFooter()}`;
  return sendEmail({
    to: recipient.email,
    subject,
    html: layout(inner),
    text,
    log: { kind: opts.reopened ? "session_reopened" : "session_cancelled", org_id: ctx.org_id, session_id: ctx.session_id, recipient_id: recipient.id ?? null },
  });
}

/** Manager requested changes on a completed session → notify the tutor. */
export function changesRequested(
  tutor: Recipient,
  ctx: SessionContext,
  note: string,
  sessionUrl: string,
): Promise<boolean> {
  const subject = `Changes requested for your ${ctx.subjectName} session`;
  const inner = `<h2 style="margin-top:0;">Changes requested</h2>
    <p>Hi ${tutor.name},</p>
    <p>A manager reviewed your <strong>${ctx.subjectName}</strong> session and asked for changes before your hours can be verified.</p>
    ${note ? `<p style="background:#fffbeb;border-radius:8px;padding:12px;"><strong>What to fix:</strong> ${escapeHtml(note)}</p>` : ""}
    ${button(sessionUrl, "Update and resubmit")}`;
  const text = `Changes requested\n\nHi ${tutor.name},\n\nA manager reviewed your ${ctx.subjectName} session and asked for changes before your hours can be verified.${note ? `\n\nWhat to fix: ${note}` : ""}\n\nUpdate and resubmit:\n${sessionUrl}${textFooter()}`;
  return sendEmail({
    to: tutor.email,
    subject,
    html: layout(inner),
    text,
    log: { kind: "changes_requested", org_id: ctx.org_id, session_id: ctx.session_id, recipient_id: tutor.id ?? null },
  });
}

/** Subject-approval decision (approved / rejected / revoked) → notify the member. */
export function approvalDecision(
  member: Recipient,
  subjectName: string,
  decision: "approved" | "rejected" | "revoked",
  note: string | null,
  ctx: { org_id?: string | null; approvalsUrl?: string } = {},
): Promise<boolean> {
  const headline =
    decision === "approved"
      ? `You're approved to tutor ${subjectName}`
      : decision === "revoked"
        ? `Your approval to tutor ${subjectName} was revoked`
        : `Your request to tutor ${subjectName} was not approved`;
  const body =
    decision === "approved"
      ? `<p>You can now claim <strong>${subjectName}</strong> requests on the tutoring board.</p>`
      : decision === "revoked"
        ? `<p>Your approval to tutor <strong>${subjectName}</strong> was revoked by a manager.</p>`
        : `<p>Your request to tutor <strong>${subjectName}</strong> was reviewed and not approved at this time.</p>`;
  const inner = `<h2 style="margin-top:0;">${headline}</h2>
    <p>Hi ${member.name},</p>
    ${body}
    ${note ? `<p style="background:#f1f5f9;border-radius:8px;padding:12px;"><strong>Note from your manager:</strong> ${escapeHtml(note)}</p>` : ""}
    ${ctx.approvalsUrl ? button(ctx.approvalsUrl, "View your approvals") : ""}`;
  const text = `${headline}\n\nHi ${member.name},\n\n${decision === "approved" ? `You can now claim ${subjectName} requests on the tutoring board.` : decision === "revoked" ? `Your approval to tutor ${subjectName} was revoked by a manager.` : `Your request to tutor ${subjectName} was reviewed and not approved at this time.`}${note ? `\n\nNote from your manager: ${note}` : ""}${ctx.approvalsUrl ? `\n\nView your approvals:\n${ctx.approvalsUrl}` : ""}${textFooter()}`;
  return sendEmail({
    to: member.email,
    subject: headline,
    html: layout(inner),
    text,
    log: { kind: "approval_decision", org_id: ctx.org_id ?? null, recipient_id: member.id ?? null },
  });
}

/** Account status changed (admitted / rejected / suspended / restored) → member. */
export function accountStatusChanged(
  member: Recipient,
  orgName: string,
  status: "active" | "rejected" | "suspended",
  context: "admitted" | "restored" | "rejected" | "suspended",
  note: string | null,
  ctx: { org_id?: string | null; dashboardUrl?: string } = {},
): Promise<boolean> {
  const map: Record<typeof context, { subject: string; heading: string; body: string }> = {
    admitted: {
      subject: `You've been admitted to ${orgName} on ${BRAND.name}`,
      heading: "You're in!",
      body: `Your account at <strong>${orgName}</strong> is now active. You can post requests, claim sessions you're approved for, and start logging volunteer hours.`,
    },
    restored: {
      subject: `Your ${orgName} account was restored`,
      heading: "Your account is active again",
      body: `Your account at <strong>${orgName}</strong> has been restored. Welcome back.`,
    },
    rejected: {
      subject: `Update on your ${orgName} account`,
      heading: "About your account",
      body: `Your request to join <strong>${orgName}</strong> on ${BRAND.name} was not approved.`,
    },
    suspended: {
      subject: `Your ${orgName} account was suspended`,
      heading: "Your account was suspended",
      body: `Your account at <strong>${orgName}</strong> has been suspended. While suspended you cannot post or give tutoring.`,
    },
  };
  const m = map[context];
  const showCta = (status === "active") && !!ctx.dashboardUrl;
  const inner = `<h2 style="margin-top:0;">${m.heading}</h2>
    <p>Hi ${member.name},</p>
    <p>${m.body}</p>
    ${note ? `<p style="background:#f1f5f9;border-radius:8px;padding:12px;"><strong>Note:</strong> ${escapeHtml(note)}</p>` : ""}
    ${showCta ? button(ctx.dashboardUrl!, "Go to your dashboard") : ""}`;
  const text = `${m.heading}\n\nHi ${member.name},\n\n${m.body.replace(/<[^>]+>/g, "")}${note ? `\n\nNote: ${note}` : ""}${showCta ? `\n\nGo to your dashboard:\n${ctx.dashboardUrl}` : ""}${textFooter()}`;
  return sendEmail({
    to: member.email,
    subject: m.subject,
    html: layout(inner),
    text,
    log: { kind: `account_${context}`, org_id: ctx.org_id ?? null, recipient_id: member.id ?? null },
  });
}

/** A pending manager was activated (or rejected) → notify them. */
export function managerActivated(
  manager: Recipient,
  orgName: string,
  decision: "activated" | "rejected",
  note: string | null,
  ctx: { org_id?: string | null; dashboardUrl?: string } = {},
): Promise<boolean> {
  const activated = decision === "activated";
  const subject = activated
    ? `Your ${orgName} Manager account is active`
    : `Update on your ${orgName} Manager account`;
  const inner = activated
    ? `<h2 style="margin-top:0;">Your Manager account is active</h2>
       <p>Hi ${manager.name},</p>
       <p>Your Manager account for <strong>${orgName}</strong> on ${BRAND.name} has been activated. You can now admit members, approve tutoring subjects, verify hours, and manage your organization.</p>
       ${ctx.dashboardUrl ? button(ctx.dashboardUrl, "Open your manager panel") : ""}`
    : `<h2 style="margin-top:0;">About your Manager account</h2>
       <p>Hi ${manager.name},</p>
       <p>Your Manager account request for <strong>${orgName}</strong> was not approved.</p>
       ${note ? `<p style="background:#f1f5f9;border-radius:8px;padding:12px;"><strong>Note:</strong> ${escapeHtml(note)}</p>` : ""}`;
  const text = activated
    ? `Your Manager account is active\n\nHi ${manager.name},\n\nYour Manager account for ${orgName} on ${BRAND.name} has been activated.${ctx.dashboardUrl ? `\n\nOpen your manager panel:\n${ctx.dashboardUrl}` : ""}${textFooter()}`
    : `About your Manager account\n\nHi ${manager.name},\n\nYour Manager account request for ${orgName} was not approved.${note ? `\n\nNote: ${note}` : ""}${textFooter()}`;
  return sendEmail({
    to: manager.email,
    subject,
    html: layout(inner),
    text,
    log: { kind: `manager_${decision}`, org_id: ctx.org_id ?? null, recipient_id: manager.id ?? null },
  });
}

/** Volunteer hours awarded on verification → notify the tutor. */
export function hoursAwarded(
  tutor: Recipient,
  subjectName: string,
  hours: number,
  note: string | null,
  ctx: { org_id?: string | null; session_id?: string | null; hoursUrl?: string } = {},
): Promise<boolean> {
  const subject = `${hours} volunteer hour${hours === 1 ? "" : "s"} added for ${subjectName}`;
  const inner = `<h2 style="margin-top:0;">Your hours are verified</h2>
    <p>Hi ${tutor.name},</p>
    <p>A manager verified your <strong>${subjectName}</strong> session and added <strong>${hours}</strong> volunteer hour${hours === 1 ? "" : "s"} to your record.</p>
    ${note ? `<p style="background:#f1f5f9;border-radius:8px;padding:12px;"><strong>Note:</strong> ${escapeHtml(note)}</p>` : ""}
    ${ctx.hoursUrl ? button(ctx.hoursUrl, "View your hours") : ""}`;
  const text = `Your hours are verified\n\nHi ${tutor.name},\n\nA manager verified your ${subjectName} session and added ${hours} volunteer hour${hours === 1 ? "" : "s"} to your record.${note ? `\n\nNote: ${note}` : ""}${ctx.hoursUrl ? `\n\nView your hours:\n${ctx.hoursUrl}` : ""}${textFooter()}`;
  return sendEmail({
    to: tutor.email,
    subject,
    html: layout(inner),
    text,
    log: { kind: "hours_awarded", org_id: ctx.org_id ?? null, session_id: ctx.session_id ?? null, recipient_id: tutor.id ?? null },
  });
}

export type ReminderDetails = {
  subjectName: string;
  date: string;
  time: string;
  location: string;
  counterpartName: string;
  role: "tutor" | "requester";
};

/** "Session tomorrow" reminder (cron) → one party. */
export function sessionReminder(
  recipient: Recipient,
  d: ReminderDetails,
  ctx: { org_id?: string | null; session_id?: string | null } = {},
): Promise<boolean> {
  const subject = `Reminder: ${d.subjectName} session tomorrow`;
  const counterpartLabel = d.role === "tutor" ? "Student" : "Tutor";
  const inner = `<h2 style="margin-top:0;">Session reminder</h2>
    <p>Hi ${recipient.name},</p>
    <p>This is a reminder about your <strong>${d.subjectName}</strong> tutoring session tomorrow:</p>
    <ul style="line-height:1.8;">
      <li><strong>Date:</strong> ${d.date}</li>
      <li><strong>Time:</strong> ${d.time}</li>
      <li><strong>Location:</strong> ${d.location}</li>
      <li><strong>${counterpartLabel}:</strong> ${d.counterpartName}</li>
    </ul>
    ${d.role === "tutor" ? "<p>Remember to record the session for your volunteer hours.</p>" : ""}`;
  const text = `Session reminder\n\nHi ${recipient.name},\n\nReminder about your ${d.subjectName} session tomorrow:\nDate: ${d.date}\nTime: ${d.time}\nLocation: ${d.location}\n${counterpartLabel}: ${d.counterpartName}${textFooter()}`;
  return sendEmail({
    to: recipient.email,
    subject,
    html: layout(inner),
    text,
    log: { kind: "session_reminder", org_id: ctx.org_id ?? null, session_id: ctx.session_id ?? null, recipient_id: recipient.id ?? null },
  });
}

/** Manual hours adjustment (positive or negative) → notify the member. */
export function adjustmentNotice(
  member: Recipient,
  hours: number,
  note: string,
  ctx: { org_id?: string | null; hoursUrl?: string } = {},
): Promise<boolean> {
  const signed = hours > 0 ? `+${hours}` : `${hours}`;
  const subject = `A volunteer hours adjustment was made to your record`;
  const inner = `<h2 style="margin-top:0;">Hours adjustment</h2>
    <p>Hi ${member.name},</p>
    <p>A manager made a <strong>${signed}</strong> volunteer hour adjustment to your record.</p>
    <p style="background:#f1f5f9;border-radius:8px;padding:12px;"><strong>Reason:</strong> ${escapeHtml(note)}</p>
    ${ctx.hoursUrl ? button(ctx.hoursUrl, "View your hours") : ""}`;
  const text = `Hours adjustment\n\nHi ${member.name},\n\nA manager made a ${signed} volunteer hour adjustment to your record.\n\nReason: ${note}${ctx.hoursUrl ? `\n\nView your hours:\n${ctx.hoursUrl}` : ""}${textFooter()}`;
  return sendEmail({
    to: member.email,
    subject,
    html: layout(inner),
    text,
    log: { kind: "hours_adjustment", org_id: ctx.org_id ?? null, recipient_id: member.id ?? null },
  });
}

export type BroadcastInput = {
  recipient: Recipient;
  orgName: string;
  subject: string;
  /** Raw plain-text body from the manager; escaped + wrapped here. */
  body: string;
  batchId: string;
  orgId: string;
  senderId: string;
};

/**
 * One recipient of a manager broadcast (§2.7). The org name is force-prefixed
 * onto the subject and a member-attribution footer is appended; the body is
 * plain text, escaped — user HTML is never rendered. Caller resolves recipients
 * strictly within the org and shares one `batchId` across the batch.
 */
export function broadcast(input: BroadcastInput): Promise<boolean> {
  const prefixedSubject = `[${input.orgName}] ${input.subject}`;
  const footerExtra = `You receive this as a member of ${input.orgName} on ${BRAND.name}.`;
  const safeBody = escapeHtml(input.body).replace(/\n/g, "<br/>");
  const inner = `<p>Hi ${input.recipient.name},</p>
    <div style="line-height:1.7;">${safeBody}</div>`;
  const text = `Hi ${input.recipient.name},\n\n${input.body}${textFooter(footerExtra)}`;
  return sendEmail({
    to: input.recipient.email,
    subject: prefixedSubject,
    html: layout(inner, footerExtra),
    text,
    log: {
      kind: "manager_broadcast",
      org_id: input.orgId,
      sender_id: input.senderId,
      recipient_id: input.recipient.id ?? null,
      batch_id: input.batchId,
    },
  });
}
