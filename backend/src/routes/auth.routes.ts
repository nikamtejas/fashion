import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { env } from "../config/env";
import { User } from "../models/User";
import { OtpToken } from "../models/OtpToken";
import { sendOtpEmail } from "../lib/mailer";
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

  const token = await OtpToken.findOne({ email, consumedAt: { $exists: false } }).sort({
    createdAt: -1,
  });
  if (!token || token.expiresAt < new Date()) {
    return res.status(401).json({ error: "Code expired or not found" });
  }
  const valid = await bcrypt.compare(code, token.codeHash);
  if (!valid) {
    return res.status(401).json({ error: "Incorrect code" });
  }

  token.consumedAt = new Date();
  await token.save();

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ email, emailVerified: new Date() });
  } else if (!user.emailVerified) {
    user.emailVerified = new Date();
    await user.save();
  }

  const session = signSession({ uid: user._id.toString(), email: user.email, role: user.role as "CUSTOMER" | "ADMIN" });
  res.cookie(env.cookieName, session, COOKIE_OPTS);
  res.json({ user: { id: user._id.toString(), email: user.email, name: user.name, role: user.role } });
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

router.post("/logout", (_req, res) => {
  res.clearCookie(env.cookieName);
  res.json({ ok: true });
});

router.get("/me", async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const user = await User.findById(req.user.uid).select("name email role image");
  if (!user) return res.json({ user: null });
  res.json({
    user: { id: user._id.toString(), email: user.email, name: user.name, role: user.role, image: user.image },
  });
});

export default router;
