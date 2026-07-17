import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { verifySession, type SessionPayload } from "../lib/jwt";
import { getCurrentRole } from "../lib/staffRoleCache";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionPayload;
    }
  }
}

export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[env.cookieName];
  if (token) {
    const payload = verifySession(token);
    if (payload) req.user = payload;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

// Staff gates re-check the role against the database (via a short-TTL
// cache — see staffRoleCache.ts) rather than trusting the `role` baked into
// the JWT at login time. Without this, deleting or demoting a staff
// account wouldn't take effect until their existing session naturally
// expired (up to 30 days) — a real gap once staff turnover is a normal
// event, not just the rare "the one admin account" case.
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const role = await getCurrentRole(req.user.uid);
  if (role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

/** ADMIN is the superuser and can reach every one of these role-gated route
 * groups too — only the specialist role is additive, never a replacement. */
function requireRole(...allowed: Array<"ADMIN" | "OPS" | "CATALOG">) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const role = await getCurrentRole(req.user.uid);
    if (role !== "ADMIN" && !allowed.includes(role as "OPS" | "CATALOG")) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

/** Day-to-day operations: orders, returns, pickups, support, POS,
 * inventory, dashboard. */
export const requireOps = requireRole("OPS");

/** Product/content management: products, photo studio, lookbooks. */
export const requireCatalog = requireRole("CATALOG");
