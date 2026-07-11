import Razorpay from "razorpay";
import { validatePaymentVerification } from "razorpay/dist/utils/razorpay-utils.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

let client: Razorpay | null = null;

function getClient(): Razorpay {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new ApiError(503, "Razorpay is not configured on this server yet");
  }
  if (!client) {
    client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  }
  return client;
}

export interface CreateRazorpayOrderResult {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

// amountInRupees is converted to paise (Razorpay's smallest currency unit for INR).
export async function createRazorpayOrder(
  amountInRupees: number,
  receipt: string
): Promise<CreateRazorpayOrderResult> {
  const razorpay = getClient();
  const amount = Math.round(amountInRupees * 100);
  const order = await razorpay.orders.create({ amount, currency: "INR", receipt });
  return {
    razorpayOrderId: order.id,
    amount,
    currency: order.currency,
    keyId: env.RAZORPAY_KEY_ID as string,
  };
}

export function verifyRazorpayPayment(orderId: string, paymentId: string, signature: string): boolean {
  if (!env.RAZORPAY_KEY_SECRET) {
    throw new ApiError(503, "Razorpay is not configured on this server yet");
  }
  return validatePaymentVerification(
    { order_id: orderId, payment_id: paymentId },
    signature,
    env.RAZORPAY_KEY_SECRET
  );
}

// Informational only — captures whichever method Razorpay reports (card, upi,
// netbanking, wallet, emi, ...). Never blocks order creation if this lookup fails.
export async function fetchRazorpayPaymentMethod(paymentId: string): Promise<string | undefined> {
  try {
    const razorpay = getClient();
    const payment = await razorpay.payments.fetch(paymentId);
    return payment.method;
  } catch {
    return undefined;
  }
}
