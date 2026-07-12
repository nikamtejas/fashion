import bcrypt from "bcryptjs";
import { OtpToken } from "../models/OtpToken";

export function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Accepts "9876543210", "+91 98765 43210", "09876..." → "+919876543210";
 * null when it isn't a valid Indian mobile number. */
export function normalizeIndianPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

export function parseDob(raw: string): Date | null {
  const dob = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return null;
  const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return age >= 13 && age <= 120 ? dob : null;
}

/** Hashes and stores a fresh 10-minute OTP under `key` (an email, or a
 * prefixed key like `sms:+91...` / `cod:user@x.com`), returning the code. */
export async function issueOtp(key: string): Promise<string> {
  const code = generateCode();
  await OtpToken.create({
    email: key,
    codeHash: await bcrypt.hash(code, 10),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  return code;
}

/** Newest still-valid unconsumed OTP matching the code, tolerant of resends
 * and out-of-order delivery (same policy as the login flow). */
export async function findValidOtp(key: string, code: string) {
  const tokens = await OtpToken.find({ email: key, consumedAt: { $exists: false } })
    .sort({ createdAt: -1 })
    .limit(5);
  for (const candidate of tokens) {
    if (candidate.expiresAt > new Date() && (await bcrypt.compare(code, candidate.codeHash))) {
      return candidate;
    }
  }
  return null;
}
