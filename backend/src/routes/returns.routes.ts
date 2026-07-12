import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { RefundRequest } from "../models/RefundRequest";
import { Order } from "../models/Order";
import { Shipment } from "../models/Shipment";
import { ShipmentEvent } from "../models/ShipmentEvent";
import { PickupAppointment } from "../models/PickupAppointment";
import { createReturnRequest } from "../services/returns.service";
import { HttpError } from "../services/order.service";

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  orderId: z.string(),
  items: z.array(z.object({ sku: z.string(), qty: z.number().int().min(1) })).min(1),
  reason: z.string().min(3),
  photoDataUris: z.array(z.string().startsWith("data:image/")).max(4).optional(),
  method: z.enum(["COURIER", "STORE"]),
  storeId: z.string().optional(),
  appointment: z
    .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), timeSlot: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/) })
    .optional(),
  bankDetails: z
    .object({ accountName: z.string().min(2), accountNumber: z.string().min(6), ifsc: z.string().min(4) })
    .optional(),
});

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });

  try {
    const refund = await createReturnRequest({ userId: req.user!.uid, ...parsed.data });
    res.status(201).json({ refund });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

async function serializeRefund(refundId: string, userId: string) {
  const refund = await RefundRequest.findById(refundId)
    .populate("storeLocation", "name address city")
    .lean();
  if (!refund) return null;
  const order = await Order.findOne({ _id: refund.order, user: userId }).lean();
  if (!order) return null;

  const appointment = refund.appointment ? await PickupAppointment.findById(refund.appointment).lean() : null;
  const shipment = refund.reverseShipment ? await Shipment.findById(refund.reverseShipment).lean() : null;
  const events = shipment
    ? await ShipmentEvent.find({ shipment: shipment._id }).sort({ timestamp: 1 }).lean()
    : [];

  const itemDetails = refund.items.map((ri) => {
    const ordered = order.items.find((oi) => oi.sku === ri.sku);
    return { sku: ri.sku, qty: ri.qty, name: ordered?.name ?? ri.sku, image: ordered?.image, price: ordered?.price ?? 0 };
  });

  return {
    id: String(refund._id),
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    status: refund.status,
    method: refund.method,
    reason: refund.reason,
    rejectionReason: refund.rejectionReason,
    refundAmount: refund.refundAmount,
    expectedCreditDate: refund.expectedCreditDate,
    items: itemDetails,
    photos: refund.photos,
    store: refund.storeLocation,
    appointment: appointment
      ? { id: String(appointment._id), date: appointment.date, timeSlot: appointment.timeSlot, status: appointment.status, qrCode: appointment.qrCode }
      : null,
    reverseShipment: shipment ? { awbNumber: shipment.awbNumber, status: shipment.status } : null,
    events: events.map((e) => ({ status: e.status, location: e.location, description: e.description, timestamp: e.timestamp })),
    createdAt: refund.createdAt,
  };
}

router.get("/", async (req, res) => {
  const orderId = req.query.orderId as string | undefined;
  const orders = await Order.find({ user: req.user!.uid }).select("_id").lean();
  const orderIds = orders.map((o) => o._id);
  const query: Record<string, unknown> = { order: { $in: orderIds } };
  if (orderId) query.order = orderId;

  const refunds = await RefundRequest.find(query).sort({ createdAt: -1 }).select("_id").lean();
  const results = [];
  for (const r of refunds) {
    const s = await serializeRefund(String(r._id), req.user!.uid);
    if (s) results.push(s);
  }
  res.json({ returns: results });
});

router.get("/:id", async (req, res) => {
  const refund = await serializeRefund(req.params.id, req.user!.uid);
  if (!refund) return res.status(404).json({ error: "Return not found" });
  res.json({ refund });
});

export default router;
