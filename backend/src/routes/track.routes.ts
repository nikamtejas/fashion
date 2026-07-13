import { Router } from "express";
import mongoose from "mongoose";
import { Order } from "../models/Order";
import { Shipment } from "../models/Shipment";
import { ShipmentEvent } from "../models/ShipmentEvent";
import { PickupAppointment } from "../models/PickupAppointment";

const router = Router();

function agoLabel(date: Date): string {
  const mins = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Public tracking: by order id (from the order page) or by AWB number
 * (shared like any courier tracking link). Deliberately returns only
 * non-sensitive data — statuses, checkpoint scans, city — never the full
 * address or payment details.
 */
router.get("/:key", async (req, res) => {
  const key = req.params.key.trim();

  let shipment = null;
  let order = null;

  if (/^\d{8,12}$/.test(key)) {
    shipment = await Shipment.findOne({ awbNumber: key });
    if (shipment) order = await Order.findById(shipment.order).lean();
  } else if (mongoose.isValidObjectId(key)) {
    order = await Order.findById(key).lean();
    if (order) shipment = await Shipment.findOne({ order: order._id, direction: "FORWARD" });
  }

  if (!order) return res.status(404).json({ error: "Nothing found for that order or AWB number" });

  // Bare order numbers/AWBs aren't enough context on a page a customer may
  // have bookmarked or shared — show what's actually in the parcel.
  const items = order.items.map((i) => ({ name: i.name, qty: i.qty, image: i.image }));

  // In-store pickup orders have their own lifecycle instead of a shipment.
  if (order.deliveryMethod === "PICKUP") {
    const appointment = await PickupAppointment.findOne({ order: order._id, type: "PICKUP" })
      .populate("storeLocation", "name city lat lng")
      .lean();
    const stage =
      appointment?.status === "COMPLETED"
        ? 3
        : appointment?.status === "READY"
          ? 2
          : order.status === "CANCELLED"
            ? -1
            : 1;
    const steps = ["Order placed", "Being prepared", "Ready for pickup", "Picked up"];
    return res.json({
      kind: "PICKUP",
      orderNumber: order.orderNumber,
      status: order.status,
      items,
      timeline: steps.map((label, i) => ({
        label,
        done: i <= stage,
        current: i === Math.min(stage + (stage < 3 ? 0 : 0), 3) && i === stage,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store: appointment?.storeLocation ?? null,
      appointment: appointment ? { date: appointment.date, timeSlot: appointment.timeSlot, status: appointment.status } : null,
    });
  }

  if (!shipment) {
    return res.json({
      kind: "HOME",
      orderNumber: order.orderNumber,
      status: order.status,
      items,
      awbNumber: null,
      events: [{ status: order.status, description: "Order placed — preparing your shipment", timestamp: order.createdAt }],
      route: [],
      current: null,
      eta: null,
      proofOfDeliveryUrl: null,
    });
  }

  const events = await ShipmentEvent.find({ shipment: shipment._id }).sort({ timestamp: 1 }).lean();
  const route = events
    .filter((e) => e.lat !== undefined && e.lat !== null)
    .map((e) => ({ lat: e.lat, lng: e.lng, label: e.location, timestamp: e.timestamp }));

  const loc = shipment.currentLocation;
  const current =
    loc?.lat !== undefined && loc?.lat !== null && loc?.scannedAt
      ? {
          lat: loc.lat,
          lng: loc.lng,
          label: loc.label,
          scannedAt: loc.scannedAt,
          // Honest phrasing: couriers give checkpoint scans, not live GPS.
          honest: `Last scanned at ${loc.label ?? "hub"}, ${agoLabel(loc.scannedAt)}`,
        }
      : null;

  res.json({
    kind: "HOME",
    orderNumber: order.orderNumber,
    status: order.status,
    items,
    awbNumber: shipment.awbNumber,
    courier: "Blue Dart (DHL)",
    events: events.map((e) => ({
      status: e.status,
      location: e.location,
      description: e.description,
      timestamp: e.timestamp,
    })),
    route,
    current,
    eta: shipment.estimatedDelivery,
    proofOfDeliveryUrl: shipment.status === "DELIVERED" ? shipment.proofOfDeliveryUrl : null,
  });
});

export default router;
