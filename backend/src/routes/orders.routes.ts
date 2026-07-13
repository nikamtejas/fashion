import { Router } from "express";
import { Order } from "../models/Order";
import { PickupAppointment } from "../models/PickupAppointment";
import { requireAuth } from "../middleware/auth";
import { loadInvoiceRenderData, renderInvoiceA4, renderInvoiceThermal } from "../services/invoice.service";
import { HttpError, cancelOrder } from "../services/order.service";

/** Self-service cancellation closes once the parcel is packed for pickup —
 * PICKUP_SCHEDULED onward means a courier (or the mock simulator) is
 * already involved, so admin has to unwind it via the shipment/RTO path. */
const PRE_SHIPMENT_STATUSES = ["PLACED", "CONFIRMED", "PACKED"];

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const orders = await Order.find({ user: req.user!.uid })
    .sort({ createdAt: -1 })
    .populate("storeLocation", "name city")
    .lean();
  res.json({ orders });
});

router.get("/:id", async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user!.uid })
    .populate("storeLocation", "name address city state pincode phone lat lng")
    .populate("coupon", "code")
    .lean();
  if (!order) return res.status(404).json({ error: "Order not found" });

  const appointment =
    order.deliveryMethod === "PICKUP"
      ? await PickupAppointment.findOne({ order: order._id }).lean()
      : null;

  res.json({ order, appointment });
});

router.post("/:id/cancel", async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user!.uid }).select("status deliveryMethod").lean();
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.deliveryMethod !== "HOME") {
      return res.status(400).json({ error: "Pickup orders are cancelled from their appointment" });
    }
    if (!PRE_SHIPMENT_STATUSES.includes(order.status)) {
      return res.status(400).json({ error: "This order has already shipped — contact support to cancel it" });
    }

    const cancelled = await cancelOrder(req.params.id, { reason: "Cancelled by customer", cancelledBy: "CUSTOMER" });
    res.json({ order: cancelled });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

/** Customer GST invoice download — A4 by default, ?format=thermal for 80mm. */
router.get("/:id/invoice.pdf", async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user!.uid }).select("_id").lean();
  if (!order) return res.status(404).json({ error: "Order not found" });

  try {
    const data = await loadInvoiceRenderData(String(order._id));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="invoice-${data.invoice.invoiceNumber}.pdf"`);
    const doc =
      req.query.format === "thermal" ? await renderInvoiceThermal(data) : await renderInvoiceA4(data);
    doc.pipe(res);
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

export default router;
