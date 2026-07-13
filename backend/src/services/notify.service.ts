import { Notification } from "../models/Notification";
import { User } from "../models/User";
import { sendEmail } from "../lib/mailer";

/** One call = one in-app notification + one email (mock-logged in dev). */
export async function notifyUser(userId: string, title: string, body: string, link?: string) {
  await Notification.create({ user: userId, title, body, link });
  const user = await User.findById(userId).select("email").lean();
  if (user) await sendEmail(user.email, title, `${body}${link ? `\n\nView: ${link}` : ""}`);
}

/** Operational alert to every ADMIN account (new orders, stock changes).
 * Sent in parallel — each is isolated so one bad mailbox never blocks the
 * rest, and one admin's slow mail server never delays the others. */
export async function notifyAdmins(subject: string, text: string, opts?: { heading?: string }) {
  const admins = await User.find({ role: "ADMIN" }).select("email").lean();
  await Promise.allSettled(
    admins.map((admin) =>
      // eslint-disable-next-line no-console
      sendEmail(admin.email, subject, text, opts).catch((e) => console.error("admin email failed:", e))
    )
  );
}
