import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalizes however someone actually types an Indian mobile number
 * ("+91 98765 43210", "91-9876543210", "9876543210") down to the bare
 * 10 digits the backend requires — without this, typing the number with
 * its country code (the common case) got rejected by a plain length check. */
export function normalizeIndianPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  return digits.slice(0, 10);
}
