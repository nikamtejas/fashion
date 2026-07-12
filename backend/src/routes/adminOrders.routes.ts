import { Router } from "express";
import { z } from "zod";
import { Order } from "../models/Order";
import { Payment } from "../models/Payment";
import { Shipment } from "../models/Shipment";
import { ShipmentEvent } from "../models/ShipmentEvent";
import { PickupAppointment } from "../models/PickupAppointment";
import { requireAdmin } from "../middleware/auth";
import { createShipmentForOrder } from "../services/shipment.service";
import { HttpError } from "../services/order.service";
import { buildShippingLabel } from "../lib/shippingLabel";

const router = Router();
router.use(requireAdmin);

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
 * own (it drives the courier lifecycle itself). */
router.post("/bulk-status", async (req, res) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Pick orders and a status" });

  const result = await Order.updateMany(
    { _id: { $in: parsed.data.ids }, status: { $ne: "PENDING_PAYMENT" } },
    { status: parsed.data.status }
  );
  res.json({ updated: result.modifiedCount });
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
