import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../services/order.service";
import { env } from "../config/env";

/** HttpError messages are deliberately written for the client ("Order not
 * found", "Not enough loyalty points") — safe to return as-is. Anything
 * else reaching here is unexpected: a raw Mongoose ValidationError/CastError
 * (which names internal schema field paths), a duplicate-key error (which
 * echoes the offending value), or a third-party API's raw response text
 * (Razorpay/Cloudinary error bodies embedded verbatim in a thrown Error by
 * the integration wrappers) — none of that should reach the client. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // eslint-disable-next-line no-console
  console.error(err);

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  const message = env.nodeEnv === "production" || !(err instanceof Error) ? "Internal server error" : err.message;
  res.status(500).json({ error: message });
}
