import { Router } from "express";
import { z } from "zod";
import { NewsletterSubscriber } from "../models/NewsletterSubscriber";
import { sendEmail } from "../lib/mailer";
import { env } from "../config/env";

const router = Router();

router.post("/subscribe", async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }
  const email = parsed.data.email.toLowerCase().trim();
  const result = await NewsletterSubscriber.updateOne(
    { email },
    { $setOnInsert: { email } },
    { upsert: true }
  );

  // Only greet genuinely new subscribers — resubmitting an already-subscribed
  // email is a silent no-op, not a resend of the welcome note.
  if (result.upsertedCount > 0) {
    try {
      await sendEmail(email, "Welcome to LuxeLoom", "You're on the list — new drops and stories, straight to your inbox.", {
        heading: "You're on the list",
        bodyHtml: `
          <p style="margin:0 0 18px;">Thanks for signing up — you'll be first to hear about new drops, lookbooks and the odd honest discount.</p>
          <p style="margin:0;">In the meantime, <a href="${env.frontendUrl}/shop" style="color:#C15B3C;">browse what's new</a>.</p>`,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("newsletter welcome email failed:", err);
    }
  }

  res.json({ ok: true });
});

router.delete("/subscribe", async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }
  await NewsletterSubscriber.deleteOne({ email: parsed.data.email.toLowerCase().trim() });
  res.json({ ok: true });
});

export default router;
