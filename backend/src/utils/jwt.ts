import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type SessionRole = "customer" | "admin";

export interface SessionPayload {
  sub: string;
  role: SessionRole;
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
}

export function verifySession(token: string): SessionPayload {
  return jwt.verify(token, env.JWT_SECRET) as SessionPayload;
}
