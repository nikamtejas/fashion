import { Router } from "express";
import { z } from "zod";
import { User } from "../models/User";
import { requireAuth } from "../middleware/auth";
import { findValidOtp, issueOtp, normalizeIndianPhone, parseDob } from "../lib/otp";
import { sendOtpSms } from "../lib/integrations/twilio";

const router = Router();
router.use(requireAuth);

/** Personal info. Email changes are deliberately unsupported (it is the
 * login identity); phone changes go through the SMS OTP flow below. */
router.patch("/", async (req, res) => {
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Enter your full name").max(80).optional(),
      dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date of birth").optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid details" });
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.name) update.name = parsed.data.name;
  if (parsed.data.dob) {
    const dob = parseDob(parsed.data.dob);
    if (!dob) return res.status(400).json({ error: "Enter a valid date of birth (13+)" });
    update.dob = dob;
  }
  if (Object.keys(update).length === 0) return res.status(400).json({ error: "Nothing to update" });

  // updateOne, not save() — full-doc validation would reject accounts whose
  // docs predate the current address schema.
  await User.updateOne({ _id: req.user!.uid }, { $set: update });
  res.json({ ok: true });
});

router.post("/phone/request", async (req, res) => {
  const parsed = z.object({ phone: z.string().min(10, "Enter your mobile number") }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const phone = normalizeIndianPhone(parsed.data.phone);
  if (!phone) return res.status(400).json({ error: "Enter a valid Indian mobile number" });

  const taken = await User.exists({ phone, _id: { $ne: req.user!.uid } });
  if (taken) return res.status(409).json({ error: "This mobile number is already linked to another account" });

  const code = await issueOtp(`sms:${phone}`);
  await sendOtpSms(phone, code);
  res.json({ ok: true, phone });
});

router.post("/phone/verify", async (req, res) => {
  const parsed = z
    .object({ phone: z.string().min(10), code: z.string().min(4) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  const phone = normalizeIndianPhone(parsed.data.phone);
  if (!phone) return res.status(400).json({ error: "Enter a valid Indian mobile number" });

  const token = await findValidOtp(`sms:${phone}`, parsed.data.code.trim());
  if (!token) return res.status(401).json({ error: "Incorrect or expired SMS code" });
  token.consumedAt = new Date();
  await token.save();

  await User.updateOne({ _id: req.user!.uid }, { $set: { phone, phoneVerified: new Date() } });
  res.json({ ok: true, phone });
});

export default router;
