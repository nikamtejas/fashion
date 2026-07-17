import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { verifySession, type SessionPayload } from "../lib/jwt";

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

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

/** ADMIN is the superuser and can reach every one of these role-gated route
 * groups too — only the specialist role is additive, never a replacement. */
function requireRole(...allowed: Array<"ADMIN" | "OPS" | "CATALOG">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (req.user.role !== "ADMIN" && !allowed.includes(req.user.role as "OPS" | "CATALOG")) {
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
