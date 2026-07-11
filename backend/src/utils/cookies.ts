import type { CookieOptions, Response } from "express";
import { env } from "../config/env.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    // Storefront and admin run on different localhost ports in dev, which browsers treat
    // as the same "site" (site = registrable domain, port-independent), so Lax cookies
    // still flow. In production, if admin/storefront live on different subdomains, set
    // COOKIE_DOMAIN to the shared parent domain and switch this to "none" (requires secure).
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    domain: env.COOKIE_DOMAIN,
    path: "/",
  };
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(env.COOKIE_NAME, token, {
    ...baseCookieOptions(),
    maxAge: SEVEN_DAYS_MS,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(env.COOKIE_NAME, baseCookieOptions());
}
