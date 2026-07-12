import crypto from "node:crypto";
import { env } from "../../config/env";
import { logIntegrationCall, serviceMock, withTimeout } from "./index";

/** Razorpay honors its own mock flag so real test keys can be used while
 * other integrations stay mocked (RAZORPAY_MOCK=false in .env). */
export const RAZORPAY_MOCK = serviceMock("RAZORPAY");

// Implemented against Razorpay's REST API directly (basic auth + HMAC
// signatures) rather than their SDK — the signature math is standard
// HMAC-SHA256 and this keeps the mock and live paths symmetrical.

const RAZORPAY_API = "https://api.razorpay.com/v1";

function keySecret(): string {
  return env.razorpayKeySecret ?? "mock_key_secret";
}

export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string;
  keyId: string;
}

/** Creates a Razorpay order for the given rupee amount. */
export async function createRazorpayOrder(amountRupees: number, receipt: string): Promise<RazorpayOrder> {
  logIntegrationCall("razorpay", "createOrder", { amountRupees, receipt, mock: RAZORPAY_MOCK });
  const amountPaise = Math.round(amountRupees * 100);

  if (RAZORPAY_MOCK) {
    return {
      id: `order_MOCK${crypto.randomBytes(6).toString("hex")}`,
      amount: amountPaise,
      currency: "INR",
      keyId: env.razorpayKeyId ?? "rzp_test_mock",
    };
  }

  const res = await withTimeout(
    fetch(`${RAZORPAY_API}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64")}`,
      },
      // Razorpay caps receipts at 40 chars — truncate defensively.
      body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt: receipt.slice(0, 40) }),
    }),
    15000,
    "razorpay:createOrder"
  );
  if (!res.ok) throw new Error(`Razorpay order creation failed: ${await res.text()}`);
  const data = (await res.json()) as { id: string; amount: number; currency: string };
  return { id: data.id, amount: data.amount, currency: data.currency, keyId: env.razorpayKeyId ?? "" };
}

/** Standard Razorpay payment signature: HMAC-SHA256(order_id|payment_id, key_secret). */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = crypto.createHmac("sha256", keySecret()).update(`${orderId}|${paymentId}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Used by the mock checkout to mint a signature the real verifier accepts,
 * so the verification code path is exercised end-to-end in dev. */
export function mockSignPayment(orderId: string, paymentId: string): string {
  return crypto.createHmac("sha256", keySecret()).update(`${orderId}|${paymentId}`).digest("hex");
}

/** Webhook signature: HMAC-SHA256 of the raw body with the webhook secret. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = env.razorpayWebhookSecret ?? "mock_webhook_secret";
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Refund wrapper — wired for Milestone 6's returns flow. */
export async function refundPayment(paymentId: string, amountRupees: number): Promise<{ refundId: string }> {
  logIntegrationCall("razorpay", "refund", { paymentId, amountRupees, mock: RAZORPAY_MOCK });
  if (RAZORPAY_MOCK) {
    return { refundId: `rfnd_MOCK${crypto.randomBytes(6).toString("hex")}` };
  }
  const res = await withTimeout(
    fetch(`${RAZORPAY_API}/payments/${paymentId}/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64")}`,
      },
      body: JSON.stringify({ amount: Math.round(amountRupees * 100) }),
    }),
    15000,
    "razorpay:refund"
  );
  if (!res.ok) throw new Error(`Razorpay refund failed: ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return { refundId: data.id };
}
