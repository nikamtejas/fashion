import { Router, raw } from "express";
import { verifyWebhookSignature } from "../lib/integrations/razorpay";
import { Payment } from "../models/Payment";
import { Order } from "../models/Order";
import { sendOrderConfirmationEmail } from "../services/order.service";
import { ensureInvoiceForOrder } from "../services/invoice.service";

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

  if (body.event === "payment.captured" && payment.status !== "PAID") {
    payment.status = "PAID";
    if (razorpayPaymentId) payment.razorpayPaymentId = razorpayPaymentId;
    await payment.save();
    await Order.updateOne({ _id: payment.order, status: "PENDING_PAYMENT" }, { status: "PLACED" });
    await sendOrderConfirmationEmail(String(payment.order));
    await ensureInvoiceForOrder(String(payment.order)).catch((e) => console.error("invoice generation failed:", e));
  } else if (body.event === "payment.failed" && payment.status === "PENDING") {
    payment.status = "FAILED";
    await payment.save();
  }

  res.json({ ok: true });
});

export default router;
