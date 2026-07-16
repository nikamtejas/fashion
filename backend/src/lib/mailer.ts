import nodemailer from "nodemailer";
import { logIntegrationCall, serviceMock } from "./integrations";
import { env } from "../config/env";

// EMAIL_MOCK=false sends real mail through the configured SMTP account
// while the global INTEGRATIONS_MOCK can stay on for other services.
const EMAIL_MOCK = serviceMock("EMAIL");

const FRONTEND_URL = env.frontendUrl;

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
      secure: false,
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
      // Reuses SMTP connections instead of paying a fresh TCP+TLS+AUTH
      // handshake per send — matters most for notifyAdmins(), which sends
      // one email per admin back to back.
      pool: true,
      maxConnections: 3,
    });
  }
  return transporter;
}

const escapeHtml = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

/** Branded wrapper shared by every LuxeLoom email — ivory canvas, serif
 * wordmark, ink text, sienna accent (all inline styles; email clients
 * strip <style> blocks). Consistent, personal-feeling mail is a big part
 * of looking trustworthy to a first-time customer. */
export function renderBrandEmail(opts: { heading: string; bodyHtml: string; footnote?: string }) {
  return `<!doctype html>
<body style="margin:0;padding:0;background:#FAF7F2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #eee5d8;">
        <tr><td style="padding:28px 32px 0;">
          <span style="font-family:${SERIF};font-size:22px;letter-spacing:1px;color:#141414;">LuxeLoom</span>
        </td></tr>
        <tr><td style="padding:18px 32px 6px;">
          <h1 style="margin:0;font-family:${SERIF};font-weight:normal;font-size:24px;line-height:1.3;color:#141414;">${opts.heading}</h1>
        </td></tr>
        <tr><td style="padding:6px 32px 26px;font-family:${SANS};font-size:15px;line-height:1.65;color:#3d3a36;">
          ${opts.bodyHtml}
        </td></tr>
        <tr><td style="padding:18px 32px 22px;border-top:1px solid #f0e9dd;font-family:${SANS};font-size:12px;line-height:1.6;color:#8a8378;">
          Need a hand? Just reply to this email or chat with us from
          <a href="${FRONTEND_URL}/account/profile?tab=support" style="color:#C15B3C;">your account</a> — a real person answers.
          ${opts.footnote ? `<br/><span style="color:#b3ab9e;">${opts.footnote}</span>` : ""}
        </td></tr>
      </table>
      <p style="font-family:${SANS};font-size:11px;color:#b3ab9e;margin:16px 0 0;">LuxeLoom · Thoughtfully crafted, honestly priced.</p>
    </td></tr>
  </table>
</body>`;
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  opts?: {
    heading?: string;
    bodyHtml?: string;
    footnote?: string;
    attachments?: { filename: string; content: Buffer }[];
  }
) {
  if (EMAIL_MOCK) {
    logIntegrationCall("email", "send", { to, subject, attachments: opts?.attachments?.map((a) => a.filename) });
    // eslint-disable-next-line no-console
    console.log(
      `\n[DEV EMAIL] To: ${to}\nSubject: ${subject}\n${text}\n` +
        (opts?.attachments?.length ? `[attachments: ${opts.attachments.map((a) => a.filename).join(", ")}]\n` : "")
    );
    return;
  }

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
    html: renderBrandEmail({
      heading: opts?.heading ?? subject,
      bodyHtml: opts?.bodyHtml ?? `<p style="margin:0;">${escapeHtml(text).replaceAll("\n", "<br/>")}</p>`,
      footnote: opts?.footnote,
    }),
    attachments: opts?.attachments,
  });
}

export async function sendOtpEmail(email: string, code: string) {
  if (EMAIL_MOCK) {
    logIntegrationCall("email", "sendOtp", { email, code });
    // eslint-disable-next-line no-console
    console.log(`\n[DEV OTP] Login code for ${email}: ${code}\n`);
    return;
  }

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    // The code itself never goes in the subject — subject lines show up in
    // lock-screen previews and inbox lists without the email being opened.
    subject: "Your LuxeLoom verification code",
    text: `${code} is your LuxeLoom verification code. It's valid for the next 10 minutes.\n\nDidn't request it? You can safely ignore this email — your account stays secure. We'll never ask you for this code by phone or message.`,
    html: renderBrandEmail({
      heading: "Here's your code",
      bodyHtml: `
        <p style="margin:0 0 18px;">Use this code to continue — it's valid for the next 10 minutes.</p>
        <p style="margin:0 0 18px;"><span style="display:inline-block;background:#FAF7F2;border:1px solid #eee5d8;border-radius:12px;padding:12px 26px;font-size:28px;letter-spacing:8px;font-weight:600;color:#141414;">${code}</span></p>
        <p style="margin:0;font-size:13px;color:#8a8378;">Didn't request this? You can safely ignore this email — your account stays secure. We'll never ask you for this code by phone or message.</p>`,
      footnote: "You're receiving this because your email address was used to sign in or verify an action on LuxeLoom.",
    }),
  });
}

// Recipients ride in bcc (never to/cc — a marketing blast must never expose
// one subscriber's address to another), sent in chunks so no single SMTP
// command tries to bcc an unbounded recipient list at once.
const NEWSLETTER_BATCH_SIZE = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Newsletter blast to every subscriber. `bodyText` is plain text written by
 * an admin (paragraphs separated by blank lines) — rendered the same way
 * sendEmail's default body is, through the shared brand template. No
 * per-recipient personalization (bcc can't do that) — subscribers only have
 * an email on file, nothing to personalize with anyway. */
export async function sendNewsletterCampaign(emails: string[], subject: string, bodyText: string) {
  const bodyHtml = bodyText
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 14px;">${escapeHtml(para).replaceAll("\n", "<br/>")}</p>`)
    .join("");
  const unsubscribeNote = `Don't want these? Unsubscribe anytime at ${FRONTEND_URL}/unsubscribe.`;

  if (EMAIL_MOCK) {
    logIntegrationCall("email", "sendNewsletterCampaign", { recipientCount: emails.length, subject });
    // eslint-disable-next-line no-console
    console.log(`\n[DEV NEWSLETTER] To ${emails.length} subscriber(s)\nSubject: ${subject}\n${bodyText}\n`);
    return;
  }

  const batches = chunk(emails, NEWSLETTER_BATCH_SIZE);
  await Promise.all(
    batches.map((batch) =>
      getTransporter().sendMail({
        from: process.env.EMAIL_FROM,
        to: process.env.EMAIL_FROM,
        bcc: batch,
        subject,
        text: `${bodyText}\n\n${unsubscribeNote}`,
        html: renderBrandEmail({ heading: subject, bodyHtml, footnote: unsubscribeNote }),
      })
    )
  );
}
