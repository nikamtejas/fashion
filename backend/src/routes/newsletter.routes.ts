import { Router } from "express";
import { z } from "zod";
import { NewsletterSubscriber } from "../models/NewsletterSubscriber";

const router = Router();

router.post("/subscribe", async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }
  const email = parsed.data.email.toLowerCase().trim();
  await NewsletterSubscriber.updateOne(
    { email },
    { $setOnInsert: { email } },
    { upsert: true }
  );
  res.json({ ok: true });
});

export default router;
