import nodemailer from "nodemailer";
import { INTEGRATIONS_MOCK, logIntegrationCall } from "./integrations";

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
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, text: string) {
  if (INTEGRATIONS_MOCK) {
    logIntegrationCall("email", "send", { to, subject });
    // eslint-disable-next-line no-console
    console.log(`\n[DEV EMAIL] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
  });
}

export async function sendOtpEmail(email: string, code: string) {
  if (INTEGRATIONS_MOCK) {
    logIntegrationCall("email", "sendOtp", { email, code });
    // eslint-disable-next-line no-console
    console.log(`\n[DEV OTP] Login code for ${email}: ${code}\n`);
    return;
  }

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Your LuxeLoom login code",
    text: `Your one-time login code is ${code}. It expires in 10 minutes.`,
    html: `<p style="font-family:sans-serif">Your one-time login code is <strong style="font-size:20px;letter-spacing:2px">${code}</strong>.<br/>It expires in 10 minutes.</p>`,
  });
}
