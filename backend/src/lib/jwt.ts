import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface SessionPayload {
  uid: string;
  email: string;
  role: "CUSTOMER" | "ADMIN" | "OPS" | "CATALOG";
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "30d" });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, env.jwtSecret) as SessionPayload;
  } catch {
    return null;
  }
}
