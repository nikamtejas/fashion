import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { verifySession, type SessionPayload, type SessionRole } from "../utils/jwt.js";
import { ApiError } from "../utils/ApiError.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: SessionPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[env.COOKIE_NAME];
  if (!token) {
    return next(new ApiError(401, "Not authenticated"));
  }
  try {
    req.session = verifySession(token);
    next();
  } catch {
    next(new ApiError(401, "Session expired or invalid"));
  }
}

export function requireRole(...roles: SessionRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.session) {
      return next(new ApiError(401, "Not authenticated"));
    }
    if (!roles.includes(req.session.role)) {
      return next(new ApiError(403, "Insufficient permissions"));
    }
    next();
  };
}
