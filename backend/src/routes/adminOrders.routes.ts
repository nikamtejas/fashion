import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { Order } from "../models/Order";
import { Payment } from "../models/Payment";
import { Shipment } from "../models/Shipment";
import { ShipmentEvent } from "../models/ShipmentEvent";
import { PickupAppointment } from "../models/PickupAppointment";
import { RefundRequest } from "../models/RefundRequest";
import { getSettings } from "../models/Settings";
import { requireAdmin } from "../middleware/auth";
import { createShipmentForOrder } from "../services/shipment.service";
import { HttpError, cancelOrder } from "../services/order.service";
import { deliveredAt } from "../services/returns.service";
import { buildShippingLabel } from "../lib/shippingLabel";
import { notifyUser } from "../services/notify.service";
import { sendDeliveredEmail } from "../services/orderEmails.service";
import { orderSubject } from "../lib/orderSubject";

const router = Router();
router.use(requireAdmin);

/** Pulls a Mongo ObjectId out of either a bare id or the full URL the
 * invoice QR encodes (`{frontendUrl}/account/orders/{id}`), so the same
 * scanner/manual-entry box on the "Check return eligibility" station
 * accepts whatever the camera actually reads off the invoice. */
function extractOrderId(raw: string): string | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/([a-f0-9]{24})(?:[/?#]|$)/i);
  const candidate = match ? match[1] : trimmed;
  return mongoose.isValidObjectId(candidate) ? candidate : null;
}

/** "Check return eligibility" station: scan the invoice QR (encodes the
 * order's internal id as a URL) or type the order number printed on the
 * invoice as plain text — either one resolves to the same order. */
router.get("/lookup/:code", async (req, res) => {
  const orderId = extractOrderId(req.params.code);
  const order = await (orderId
    ? Order.findById(orderId)
    : Order.findOne({ orderNumber: req.params.code.trim().toUpperCase() })
  ).populate("user", "name email phone").lean();
  if (!order) return res.status(404).json({ error: "No order matches this code" });

  const [delivered, settings, existingReturns] = await Promise.all([
    deliveredAt(order),
    getSettings(),
    RefundRequest.find({ order: order._id }).select("status method createdAt refundAmount").sort({ createdAt: -1 }).lean(),
  ]);

  const windowMs = settings.returnWindowDays * 24 * 60 * 60 * 1000;
  const daysSinceDelivered = delivered ? Math.floor((Date.now() - delivered.getTime()) / (24 * 60 * 60 * 1000)) : null;
  const expiresAt = delivered ? new Date(delivered.getTime() + windowMs) : null;
  const eligible = Boolean(delivered && Date.now() - delivered.getTime() <= windowMs);

  const user = order.user as unknown as { name?: string; email?: string; phone?: string } | null;
  res.json({
    order: {
      _id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      deliveryMethod: order.deliveryMethod,
      items: order.items.map((i) => ({ sku: i.sku, name: i.name, size: i.size, color: i.color, qty: i.qty, price: i.price, image: i.image })),
      total: order.pricing.total,
    },
    customer: { name: user?.name, email: user?.email, phone: user?.phone },
    delivery: {
      deliveredAt: delivered,
      daysSinceDelivered,
      returnWindowDays: settings.returnWindowDays,
      expiresAt,
      eligible: order.status === "DELIVERED" ? eligible : false,
      reason:
        order.status !== "DELIVERED"
          ? `Order is ${order.status.replaceAll("_", " ").toLowerCase()}, not delivered yet`
          : !delivered
            ? "Delivery date couldn't be determined"
            : !eligible
              ? `${settings.returnWindowDays}-day return window has closed`
              : null,
    },
    existingReturns: existingReturns.map((r) => ({
      id: r._id,
      status: r.status,
      method: r.method,
      refundAmount: r.refundAmount,
      createdAt: r.createdAt,
    })),
  });
});

router.get("/", async (req, res) => {
  const status = req.query.status as string | undefined;
  const q = (req.query.q as string | undefined)?.trim();
  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (q) {
    // Search by order number, or by customer email (resolved to user ids).
    const { User } = await import("../models/User.js");
    const users = await User.find({ email: { $regex: q, $options: "i" } }).select("_id").limit(20).lean();
    query.$or = [{ orderNumber: { $regex: q, $options: "i" } }, { user: { $in: users.map((u) => u._id) } }];
  }

  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("user", "email name")
    .populate("storeLocation", "name city")
    .lean();

  res.json({ orders });
});

const bulkSchema = z.object({
  ids: z.array(z.string()).min(1),
  status: z.enum(["CONFIRMED", "PACKED", "CANCELLED", "DELIVERED"]),
});

/** Bulk manual status override — for statuses the shipment engine doesn't
 * own (it drives the courier lifecycle itself). CANCELLED is handled
 * separately below since it needs stock restore + refund per order, not a
 * blanket updateMany. */
const BULK_STATUS_COPY: Record<string, { title: (n: string, items: { name: string }[]) => string; body: string }> = {
  CONFIRMED: {
    title: (n, items) => orderSubject("Order confirmed", n, items),
    body: "We're preparing your pieces now — you'll get tracking details the moment your order ships.",
  },
  PACKED: {
    title: (n, items) => orderSubject("Order packed", n, items),
    body: "Your pieces are packed, quality-checked and ready to ship.",
  },
};

router.post("/bulk-status", async (req, res) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Pick orders and a status" });

  if (parsed.data.status === "CANCELLED") {
    // Each order needs its own transaction, but the orders are independent
    // of each other — run them concurrently instead of one at a time so
    // wall-clock time is the slowest single cancellation, not the sum of all.
    const settled = await Promise.allSettled(
      parsed.data.ids.map((id) => cancelOrder(id, { reason: "Cancelled by admin", cancelledBy: "ADMIN" }))
    );
    let updated = 0;
    const errors: string[] = [];
    settled.forEach((result, i) => {
      if (result.status === "fulfilled") {
        updated++;
      } else {
        errors.push(result.reason instanceof HttpError ? result.reason.message : "Unknown error");
        // eslint-disable-next-line no-console
        console.error(`bulk-cancel failed for order ${parsed.data.ids[i]}:`, result.reason);
      }
    });
    return res.json({ updated, errors: errors.length ? errors : undefined });
  }

  // Snapshot first so only orders whose status actually changes get emailed.
  const affected = await Order.find({ _id: { $in: parsed.data.ids }, status: { $ne: "PENDING_PAYMENT" } })
    .select("orderNumber user status items")
    .lean();
  const result = await Order.updateMany(
    { _id: { $in: parsed.data.ids }, status: { $ne: "PENDING_PAYMENT" } },
    { status: parsed.data.status }
  );
  res.json({ updated: result.modifiedCount });

  // Customer notifications after responding — a mail hiccup shouldn't fail
  // the admin action. Independent per order, so send them concurrently
  // rather than waiting on each one's mail round trip in turn.
  await Promise.all(
    affected
      .filter((o) => o.status !== parsed.data.status)
      .map(async (o) => {
        try {
          if (parsed.data.status === "DELIVERED") {
            await sendDeliveredEmail(String(o._id));
          } else {
            const copy = BULK_STATUS_COPY[parsed.data.status];
            if (copy) await notifyUser(String(o.user), copy.title(o.orderNumber, o.items), copy.body, `/account/orders/${o._id}`);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`bulk-status notification failed for ${o.orderNumber}:`, err);
        }
      })
  );
});

const notesSchema = z.object({ notes: z.string().max(2000) });

router.patch("/:id/notes", async (req, res) => {
  const parsed = notesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid notes" });
  const result = await Order.updateOne({ _id: req.params.id }, { notes: parsed.data.notes });
  if (result.matchedCount === 0) return res.status(404).json({ error: "Order not found" });
  res.json({ ok: true });
});

router.get("/:id", async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("user", "email name")
    .populate("storeLocation", "name address city state pincode")
    .populate("coupon", "code")
    .lean();
  if (!order) return res.status(404).json({ error: "Order not found" });

  const [payment, shipment, appointment] = await Promise.all([
    Payment.findOne({ order: order._id }).lean(),
    Shipment.findOne({ order: order._id, direction: "FORWARD" }).lean(),
    PickupAppointment.findOne({ order: order._id, type: "PICKUP" }).lean(),
  ]);
  const events = shipment
    ? await ShipmentEvent.find({ shipment: shipment._id }).sort({ timestamp: 1 }).lean()
    : [];

  res.json({ order, payment, shipment, events, appointment });
});

/** "Ready to Ship": waybill + label + pickup registration + lifecycle events. */
router.post("/:id/ready-to-ship", async (req, res) => {
  try {
    const shipment = await createShipmentForOrder(req.params.id);
    res.status(201).json({ shipment });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

/** Delivery agent collected cash at the door — the HOME-delivery analog of
 * the in-store pickup handover's COD collection (adminPickups.routes.ts). */
router.post("/:id/cod/mark-cash-collected", async (req, res) => {
  const order = await Order.findById(req.params.id).select("deliveryMethod status").lean();
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.deliveryMethod !== "HOME") {
    return res.status(400).json({ error: "Pickup COD is collected at handover, not here" });
  }
  if (!["OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status)) {
    return res.status(400).json({ error: "Order hasn't reached delivery yet" });
  }
  const result = await Payment.updateOne(
    { order: order._id, method: "COD", status: "PENDING" },
    { $set: { status: "PAID", codRemittanceStatus: "PENDING", codCollectedAt: new Date() } }
  );
  if (result.modifiedCount === 0) {
    return res.status(400).json({ error: "No pending COD payment to collect on this order" });
  }
  res.json({ ok: true });
});

/** Cancellation refunds with no refund API (COD/CASH/CARD/UPI) park at
 * REFUND_PENDING until the customer submits bank details — see
 * payments.routes.ts refund-bank-details. */
router.get("/refunds/pending", async (req, res) => {
  const payments = await Payment.find({ status: "REFUND_PENDING" })
    .populate({ path: "order", select: "orderNumber user pricing.total cancelledAt", populate: { path: "user", select: "email" } })
    .sort({ updatedAt: -1 })
    .lean();
  res.json({ payments });
});

router.post("/:id/mark-refund-paid", async (req, res) => {
  const order = await Order.findById(req.params.id).select("orderNumber user pricing.total items").lean();
  if (!order) return res.status(404).json({ error: "Order not found" });

  const payment = await Payment.findOne({ order: order._id, status: "REFUND_PENDING" });
  if (!payment) return res.status(400).json({ error: "No pending manual refund on this order" });
  if (!payment.refundBankDetails?.accountNumber) {
    return res.status(400).json({ error: "The customer hasn't submitted bank details yet" });
  }

  payment.status = "REFUNDED";
  payment.refundedAt = new Date();
  await payment.save();

  await notifyUser(
    String(order.user),
    orderSubject("Refund credited", order.orderNumber, order.items),
    `Your refund of ₹${order.pricing.total.toLocaleString("en-IN")} has been credited to your bank account.`,
    `/account/orders/${order._id}`
  );

  res.json({ ok: true });
});

router.get("/:id/label.pdf", async (req, res) => {
  const order = await Order.findById(req.params.id).lean();
  if (!order) return res.status(404).json({ error: "Order not found" });
  const shipment = await Shipment.findOne({ order: order._id }).sort({ createdAt: -1 }).lean();
  if (!shipment?.awbNumber) return res.status(400).json({ error: "Ship the order first to get a label" });
  const payment = await Payment.findOne({ order: order._id }).select("method").lean();

  const address = order.shippingAddress;
  if (!address) return res.status(400).json({ error: "No shipping address on this order" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="label-${order.orderNumber}.pdf"`);

  const doc = buildShippingLabel({
    orderNumber: order.orderNumber,
    awbNumber: shipment.awbNumber,
    codAmount: payment?.method === "COD" ? order.pricing.total : undefined,
    to: {
      name: address.name,
      line1: address.line1,
      line2: address.line2 ?? undefined,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      phone: address.phone,
    },
    itemCount: order.items.reduce((sum, i) => sum + i.qty, 0),
    reverse: shipment.direction === "REVERSE",
  });
  doc.pipe(res);
});

export default router;
