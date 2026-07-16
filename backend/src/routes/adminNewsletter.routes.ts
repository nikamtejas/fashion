import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import { NewsletterSubscriber } from "../models/NewsletterSubscriber";
import { NewsletterCampaign } from "../models/NewsletterCampaign";
import { sendNewsletterCampaign } from "../lib/mailer";

const router = Router();
router.use(requireAdmin);

router.get("/", async (_req, res) => {
  const [subscriberCount, campaigns] = await Promise.all([
    NewsletterSubscriber.countDocuments({}),
    NewsletterCampaign.find({}).populate("sentBy", "name email").sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  res.json({ subscriberCount, campaigns });
});

const sendSchema = z.object({
  subject: z.string().trim().min(3, "Give the campaign a subject").max(150),
  body: z.string().trim().min(10, "Write a bit more in the message").max(20000),
});

/** Sends the campaign to every current subscriber (bcc-batched — see
 * sendNewsletterCampaign) and logs it so the admin has a history of what
 * went out and to how many people. */
router.post("/send", async (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid campaign" });

  const subscribers = await NewsletterSubscriber.find({}).select("email").lean();
  if (subscribers.length === 0) return res.status(400).json({ error: "There are no subscribers yet" });

  await sendNewsletterCampaign(
    subscribers.map((s) => s.email),
    parsed.data.subject,
    parsed.data.body
  );

  const campaign = await NewsletterCampaign.create({
    subject: parsed.data.subject,
    body: parsed.data.body,
    recipientCount: subscribers.length,
    sentBy: req.user!.uid,
  });

  res.status(201).json({ campaign });
});

export default router;
