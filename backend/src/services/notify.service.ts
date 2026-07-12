import { Notification } from "../models/Notification";
import { User } from "../models/User";
import { sendEmail } from "../lib/mailer";

/** One call = one in-app notification + one email (mock-logged in dev). */
export async function notifyUser(userId: string, title: string, body: string, link?: string) {
  await Notification.create({ user: userId, title, body, link });
  const user = await User.findById(userId).select("email").lean();
  if (user) await sendEmail(user.email, title, `${body}${link ? `\n\nView: ${link}` : ""}`);
}
