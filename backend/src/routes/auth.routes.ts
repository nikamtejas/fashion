import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { env } from "../config/env";
import { User } from "../models/User";
import { OtpToken } from "../models/OtpToken";
import { sendOtpEmail } from "../lib/mailer";
import { sendOtpSms } from "../lib/integrations/twilio";
import { findValidOtp, issueOtp, normalizeIndianPhone, parseDob } from "../lib/otp";
import { signSession } from "../lib/jwt";
import { buildGoogleAuthUrl, exchangeGoogleCode } from "../lib/googleOAuth";

const router = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.nodeEnv === "production",
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post("/otp/request", async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }
  const email = parsed.data.email.toLowerCase().trim();

  // Login is for existing customers only — new customers must register
  // (name, date of birth, verified phone) before they can sign in.
  const exists = await User.exists({ email });
  if (!exists) {
    return res.status(404).json({
      error: "No LuxeLoom account uses this email — create one first",
      code: "NOT_REGISTERED",
    });
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await OtpToken.create({ email, codeHash, expiresAt });
  await sendOtpEmail(email, code);

  res.json({ ok: true });
});

router.post("/otp/verify", async (req, res) => {
  const parsed = z
    .object({ email: z.string().email(), code: z.string().min(4) })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request" });
  }
  const email = parsed.data.email.toLowerCase().trim();
  const code = parsed.data.code.trim();

  // Accept the code from ANY still-valid email, not just the newest one —
  // resend clicks and out-of-order email delivery otherwise reject codes
  // the user legitimately received minutes ago.
  const tokens = await OtpToken.find({ email, consumedAt: { $exists: false } })
    .sort({ createdAt: -1 })
    .limit(5);
  const live = tokens.filter((t) => t.expiresAt > new Date());
  if (live.length === 0) {
    return res.status(401).json({ error: "Code expired or not found — request a new one" });
  }
  let token = null;
  for (const candidate of live) {
    if (await bcrypt.compare(code, candidate.codeHash)) {
      token = candidate;
      break;
    }
  }
  if (!token) {
    return res.status(401).json({ error: "Incorrect code — use the code from your newest email" });
  }

  token.consumedAt = new Date();
  await token.save();

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({
      error: "No LuxeLoom account uses this email — create one first",
      code: "NOT_REGISTERED",
    });
  }
  if (!user.emailVerified) {
    // Targeted update, NOT user.save(): save() re-validates the whole
    // document, and users whose docs predate the current address schema
    // (legacy addresses without name/phone) would fail login with an
    // unrelated "addresses.0.phone is required" validation error.
    await User.updateOne({ _id: user._id }, { $set: { emailVerified: new Date() } });
  }

  const session = signSession({ uid: user._id.toString(), email: user.email, role: user.role as "CUSTOMER" | "ADMIN" });
  res.cookie(env.cookieName, session, COOKIE_OPTS);
  res.json({ user: { id: user._id.toString(), email: user.email, name: user.name, role: user.role } });
});

// ─── Registration (email OTP + Twilio SMS OTP + name + date of birth) ──────

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(10, "Enter your mobile number"),
});

/** Validates the details, then sends one OTP to the email (existing mailer)
 * and one to the phone (Twilio). Nothing is persisted until /register/verify
 * confirms both codes. */
router.post("/register/request", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid details" });
  }
  const email = parsed.data.email.toLowerCase().trim();
  const phone = normalizeIndianPhone(parsed.data.phone);
  if (!phone) return res.status(400).json({ error: "Enter a valid Indian mobile number" });
  if (!parseDob(parsed.data.dob)) return res.status(400).json({ error: "Enter a valid date of birth (13+)" });

  if (await User.exists({ email })) {
    return res.status(409).json({
      error: "An account with this email already exists — log in instead",
      code: "ALREADY_REGISTERED",
    });
  }
  if (await User.exists({ phone })) {
    return res.status(409).json({ error: "This mobile number is already linked to another account" });
  }

  const emailCode = await issueOtp(email);
  const phoneCode = await issueOtp(`sms:${phone}`);

  await sendOtpEmail(email, emailCode);
  await sendOtpSms(phone, phoneCode);

  res.json({ ok: true, phone });
});

router.post("/register/verify", async (req, res) => {
  const parsed = registerSchema
    .extend({ emailCode: z.string().min(4), phoneCode: z.string().min(4) })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const email = parsed.data.email.toLowerCase().trim();
  const phone = normalizeIndianPhone(parsed.data.phone);
  const dob = parseDob(parsed.data.dob);
  if (!phone || !dob) return res.status(400).json({ error: "Invalid phone number or date of birth" });

  if (await User.exists({ email })) {
    return res.status(409).json({
      error: "An account with this email already exists — log in instead",
      code: "ALREADY_REGISTERED",
    });
  }

  const emailToken = await findValidOtp(email, parsed.data.emailCode.trim());
  if (!emailToken) {
    return res.status(401).json({ error: "Incorrect or expired email code", field: "emailCode" });
  }
  const phoneToken = await findValidOtp(`sms:${phone}`, parsed.data.phoneCode.trim());
  if (!phoneToken) {
    return res.status(401).json({ error: "Incorrect or expired SMS code", field: "phoneCode" });
  }

  const now = new Date();
  emailToken.consumedAt = now;
  phoneToken.consumedAt = now;
  await Promise.all([emailToken.save(), phoneToken.save()]);

  const user = await User.create({
    email,
    name: parsed.data.name.trim(),
    dob,
    phone,
    emailVerified: now,
    phoneVerified: now,
  });

  const session = signSession({ uid: user._id.toString(), email: user.email, role: user.role as "CUSTOMER" | "ADMIN" });
  res.cookie(env.cookieName, session, COOKIE_OPTS);
  res.status(201).json({ user: { id: user._id.toString(), email: user.email, name: user.name, role: user.role } });
});

router.get("/google", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("ll_oauth_state", state, { ...COOKIE_OPTS, maxAge: 10 * 60 * 1000 });
  res.redirect(buildGoogleAuthUrl(state));
});

router.get("/google/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const savedState = req.cookies?.ll_oauth_state;

  if (!code || !state || state !== savedState) {
    return res.redirect(`${env.frontendUrl}/login?error=oauth_failed`);
  }
  res.clearCookie("ll_oauth_state");

  try {
    const profile = await exchangeGoogleCode(code);
    const email = profile.email.toLowerCase();

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        name: profile.name,
        image: profile.picture,
        emailVerified: new Date(),
        googleId: profile.sub,
      });
    }

    const session = signSession({ uid: user._id.toString(), email: user.email, role: user.role as "CUSTOMER" | "ADMIN" });
    res.cookie(env.cookieName, session, COOKIE_OPTS);
    res.redirect(env.frontendUrl);
  } catch {
    res.redirect(`${env.frontendUrl}/login?error=oauth_failed`);
  }
});

/** Admin bootstrap: creates (or promotes) an ADMIN account for the given
 * email. Guarded by ADMIN_SETUP_KEY from the backend environment — the
 * route is disabled entirely when the key isn't set. The account still
 * logs in normally via email OTP; this only grants the role. */
router.post("/admin/setup", async (req, res) => {
  const parsed = z.object({ email: z.string().email(), key: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Provide an email and the admin setup key" });
  }
  if (!env.adminSetupKey) {
    return res.status(404).json({ error: "Admin setup is disabled — set ADMIN_SETUP_KEY in the backend .env" });
  }
  const supplied = Buffer.from(parsed.data.key);
  const expected = Buffer.from(env.adminSetupKey);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return res.status(403).json({ error: "Invalid setup key" });
  }

  const email = parsed.data.email.toLowerCase().trim();
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ email, role: "ADMIN", emailVerified: new Date() });
  } else if (user.role !== "ADMIN") {
    // updateOne, not save() — see /otp/verify: full-doc validation would
    // reject accounts whose docs predate the current address schema.
    await User.updateOne({ _id: user._id }, { $set: { role: "ADMIN" } });
    user.role = "ADMIN";
  }

  res.json({
    user: { id: user._id.toString(), email: user.email, role: user.role },
    note: "Account has the ADMIN role — log in with the email OTP as usual.",
  });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(env.cookieName);
  res.json({ ok: true });
});

router.get("/me", async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const user = await User.findById(req.user.uid).select("name email role image phone phoneVerified dob");
  if (!user) return res.json({ user: null });
  res.json({
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      image: user.image,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      dob: user.dob ? user.dob.toISOString().slice(0, 10) : undefined,
    },
  });
});

export default router;
