import { Router, raw } from "express";
import { verifyWebhookSignature } from "../lib/integrations/razorpay";
import { Payment } from "../models/Payment";
import { Order } from "../models/Order";
import { onOrderConfirmed } from "../services/confirmation.service";

const router = Router();

interface RazorpayWebhookBody {
  event: string;
  payload?: {
    payment?: {
      entity?: { id?: string; order_id?: string };
    };
  };
}

// Mounted BEFORE express.json() in app.ts — signature verification needs
// the exact raw bytes Razorpay signed, not a re-serialized parse.
router.post("/razorpay", raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const rawBody = (req.body as Buffer)?.toString("utf8") ?? "";

  if (typeof signature !== "string" || !verifyWebhookSignature(rawBody, signature)) {
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  let body: RazorpayWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const razorpayOrderId = body.payload?.payment?.entity?.order_id;
  const razorpayPaymentId = body.payload?.payment?.entity?.id;
  if (!razorpayOrderId) return res.json({ ok: true }); // event we don't track

  const payment = await Payment.findOne({ razorpayOrderId });
  if (!payment) return res.json({ ok: true }); // not ours / already cleaned up

  let justConfirmed = false;
  if (body.event === "payment.captured" && payment.status !== "PAID") {
    // Same race as /razorpay/verify (payments.routes.ts) — the browser's
    // own callback can land within milliseconds of this webhook. Claim the
    // transition atomically so only whichever of the two actually wins
    // triggers onOrderConfirmed().
    const claim = await Payment.updateOne(
      { _id: payment._id, status: { $ne: "PAID" } },
      { $set: { status: "PAID", ...(razorpayPaymentId ? { razorpayPaymentId } : {}) } }
    );
    if (claim.modifiedCount > 0) {
      await Order.updateOne({ _id: payment.order, status: "PENDING_PAYMENT" }, { status: "PLACED" });
      justConfirmed = true;
    }
  } else if (body.event === "payment.failed" && payment.status === "PENDING") {
    payment.status = "FAILED";
    await payment.save();
  }

  res.json({ ok: true });
  // Razorpay retries webhooks that don't ack quickly — respond first, then
  // run the email/invoice/loyalty chain (real SMTP sends can take seconds).
  if (justConfirmed) {
    onOrderConfirmed(String(payment.order)).catch((err) => console.error("onOrderConfirmed failed:", err));
  }
});

export default router;
