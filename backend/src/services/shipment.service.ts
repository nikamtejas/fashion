import type { HydratedDocument } from "mongoose";
import { Shipment, type ShipmentDoc } from "../models/Shipment";
import { ShipmentEvent } from "../models/ShipmentEvent";
import { Order } from "../models/Order";
import { RefundRequest } from "../models/RefundRequest";
import { generateWaybill, registerPickup, checkServiceability } from "../lib/integrations/bluedart";
import { geocodePincode } from "../lib/integrations/pincode";
import { serviceMock } from "../lib/integrations";
import { notifyUser } from "./notify.service";
import { HttpError } from "./order.service";
import { processRefund } from "./returns.service";
import { sendDeliveredEmail } from "./orderEmails.service";

// LuxeLoom's (fictional) origin warehouse.
export const WAREHOUSE = { label: "Bhiwandi Hub", lat: 19.2813, lng: 73.0483, pincode: "421302" };

const STATUS_LABELS: Record<string, string> = {
  PICKUP_SCHEDULED: "Pickup scheduled",
  PICKED_UP: "Picked up",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  RTO: "Returned to origin",
};

type ShipmentStatus = "PENDING" | "PICKUP_SCHEDULED" | "PICKED_UP" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "RTO";

interface TransitionOpts {
  location?: string;
  description?: string;
  coords?: { lat: number; lng: number };
}

/** Single choke-point for every shipment status change: persists the
 * ShipmentEvent, mirrors onto the Order, updates any linked return, and
 * notifies the customer (email + in-app). */
export async function transitionShipment(
  shipment: HydratedDocument<ShipmentDoc>,
  status: ShipmentStatus,
  opts: TransitionOpts = {}
) {
  shipment.status = status;
  if (opts.coords) {
    shipment.currentLocation = {
      lat: opts.coords.lat,
      lng: opts.coords.lng,
      label: opts.location,
      scannedAt: new Date(),
    } as typeof shipment.currentLocation;
  }
  if (status === "DELIVERED" && shipment.direction === "FORWARD") {
    // Courier APIs return a POD image/reference on delivery; mocked here.
    shipment.proofOfDeliveryUrl = `https://res.cloudinary.com/demo/image/upload/sample.jpg`;
  }
  await shipment.save();

  await ShipmentEvent.create({
    shipment: shipment._id,
    status,
    location: opts.location,
    lat: opts.coords?.lat,
    lng: opts.coords?.lng,
    description: opts.description ?? STATUS_LABELS[status],
    timestamp: new Date(),
  });

  const order = await Order.findById(shipment.order);
  if (!order) return;

  if (shipment.direction === "FORWARD") {
    const orderStatus = status === "PENDING" ? order.status : status;
    if (order.status !== orderStatus) {
      order.status = orderStatus as typeof order.status;
      await order.save();
    }
    if (status === "DELIVERED") {
      // Delivered gets the rich email with the GST invoice attached.
      await sendDeliveredEmail(String(order._id));
    } else {
      await notifyUser(
        String(order.user),
        `Order ${order.orderNumber}: ${STATUS_LABELS[status] ?? status}`,
        opts.description ?? `${STATUS_LABELS[status]}${opts.location ? ` — ${opts.location}` : ""}`,
        `/track/${order._id}`
      );
    }
  } else {
    // Reverse pickup drives the linked refund request's tracker.
    const refund = await RefundRequest.findOne({ reverseShipment: shipment._id });
    if (refund) {
      if (status === "PICKED_UP" && refund.status === "APPROVED") {
        refund.status = "ITEM_PICKED_UP";
        await refund.save();
        await notifyUser(String(order.user), "Return picked up", "Your return is on its way back to us.", `/account/orders/${order._id}`);
      } else if (status === "DELIVERED" && ["ITEM_PICKED_UP", "APPROVED"].includes(refund.status)) {
        refund.status = "RECEIVED";
        await refund.save();
        await notifyUser(String(order.user), "Return received", "We've received your return — your refund is being processed.", `/account/orders/${order._id}`);
        await processRefund(String(refund._id));
      }
    }
  }
}

/** Admin "Ready to Ship": waybill + label + courier pickup registration,
 * with CONFIRMED → PACKED → PICKUP_SCHEDULED recorded in order. */
export async function createShipmentForOrder(orderId: string) {
  const order = await Order.findById(orderId);
  if (!order) throw new HttpError(404, "Order not found");
  if (order.deliveryMethod !== "HOME") throw new HttpError(400, "Pickup orders don't ship — they're collected in store");
  if (order.status !== "PLACED" && order.status !== "CONFIRMED") {
    throw new HttpError(400, `Order is ${order.status} — only PLACED orders can be shipped`);
  }
  if (await Shipment.exists({ order: order._id, direction: "FORWARD" })) {
    throw new HttpError(409, "This order already has a shipment");
  }

  const pincode = order.shippingAddress?.pincode ?? "";
  const { awbNumber } = await generateWaybill({
    orderNumber: order.orderNumber,
    codAmount: order.pricing.codFee !== undefined && (await isCod(order._id)) ? order.pricing.total : undefined,
    destinationPincode: pincode,
  });
  await registerPickup(awbNumber, new Date());

  const svc = await checkServiceability(pincode).catch(() => ({ serviceable: true, etaDays: 4 }));
  const etaDays = ("etaDays" in svc ? svc.etaDays : undefined) ?? 4;

  const shipment = await Shipment.create({
    order: order._id,
    direction: "FORWARD",
    awbNumber,
    status: "PENDING",
    pickupScheduledAt: new Date(),
    estimatedDelivery: new Date(Date.now() + etaDays * 24 * 60 * 60 * 1000),
    currentLocation: { ...WAREHOUSE, scannedAt: new Date(), label: WAREHOUSE.label },
  });

  order.status = "CONFIRMED";
  await order.save();
  await ShipmentEvent.create({ shipment: shipment._id, status: "CONFIRMED", description: "Order confirmed", timestamp: new Date() });
  order.status = "PACKED";
  await order.save();
  await ShipmentEvent.create({ shipment: shipment._id, status: "PACKED", description: "Packed at warehouse", location: WAREHOUSE.label, timestamp: new Date() });

  await transitionShipment(shipment, "PICKUP_SCHEDULED", {
    location: WAREHOUSE.label,
    description: `Courier pickup scheduled (AWB ${awbNumber})`,
    coords: WAREHOUSE,
  });

  return shipment;
}

async function isCod(orderId: import("mongoose").Types.ObjectId): Promise<boolean> {
  const { Payment } = await import("../models/Payment.js");
  const payment = await Payment.findOne({ order: orderId }).select("method").lean();
  return payment?.method === "COD";
}

/** Creates the reverse-pickup shipment for an approved courier return. */
export async function createReverseShipment(orderId: string) {
  const order = await Order.findById(orderId);
  if (!order) throw new HttpError(404, "Order not found");

  const pincode = order.shippingAddress?.pincode ?? WAREHOUSE.pincode;
  const { awbNumber } = await generateWaybill({
    orderNumber: order.orderNumber,
    destinationPincode: WAREHOUSE.pincode,
    reverse: true,
  });
  await registerPickup(awbNumber, new Date());

  const origin = (await geocodePincode(pincode)) ?? WAREHOUSE;
  const shipment = await Shipment.create({
    order: order._id,
    direction: "REVERSE",
    awbNumber,
    status: "PENDING",
    pickupScheduledAt: new Date(),
    estimatedDelivery: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    currentLocation: { lat: origin.lat, lng: origin.lng, label: "Customer location", scannedAt: new Date() },
  });

  await transitionShipment(shipment, "PICKUP_SCHEDULED", {
    location: order.shippingAddress?.city ?? "Customer location",
    description: `Reverse pickup scheduled (AWB ${awbNumber})`,
    coords: origin,
  });

  return shipment;
}

// ─── MOCK simulator ─────────────────────────────────────────────────────────
// Advances every active shipment one checkpoint per tick (30s in dev), so
// the whole tracking/return/refund journey is demoable without Blue Dart.

interface SimStep {
  status: ShipmentStatus;
  label: (city: string) => string;
  description: (city: string) => string;
  at: (dest: { lat: number; lng: number }, origin: { lat: number; lng: number }) => { lat: number; lng: number };
}

const midpoint = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => ({
  lat: (a.lat + b.lat) / 2,
  lng: (a.lng + b.lng) / 2,
});

const FORWARD_STEPS: SimStep[] = [
  {
    status: "PICKED_UP",
    label: () => WAREHOUSE.label,
    description: () => "Shipment picked up by courier",
    at: (_d, o) => o,
  },
  {
    status: "IN_TRANSIT",
    label: () => WAREHOUSE.label,
    description: () => "Departed Bhiwandi Hub",
    at: (_d, o) => o,
  },
  {
    status: "IN_TRANSIT",
    label: (city) => `${city} Hub`,
    description: (city) => `Arrived at ${city} Hub`,
    at: (d, o) => midpoint(d, o),
  },
  {
    status: "OUT_FOR_DELIVERY",
    label: (city) => `${city} delivery centre`,
    description: () => "Out for delivery",
    at: (d) => d,
  },
  {
    status: "DELIVERED",
    label: (city) => city,
    description: () => "Delivered — signed by recipient",
    at: (d) => d,
  },
];

const REVERSE_STEPS: SimStep[] = [
  {
    status: "PICKED_UP",
    label: (city) => city,
    description: () => "Return picked up from customer",
    at: (d) => d, // dest here is the customer for display purposes
  },
  {
    status: "IN_TRANSIT",
    label: (city) => `${city} Hub`,
    description: (city) => `Departed ${city} Hub`,
    at: (d, o) => midpoint(d, o),
  },
  {
    status: "DELIVERED",
    label: () => WAREHOUSE.label,
    description: () => "Return received at warehouse",
    at: (_d, o) => o,
  },
];

export async function advanceMockShipments() {
  // Keyed to the Blue Dart mock specifically: the simulator must keep
  // driving realtime tracking even when other services (Razorpay) go live.
  if (!serviceMock("BLUEDART")) return;

  // Nobody mans a warehouse in this mock environment — without this, a
  // shipment (and therefore any tracking data at all) only exists once an
  // admin manually clicks "Ready to ship" on every order. Auto-ship any
  // confirmed HOME order so customers see live tracking within one tick of
  // checkout, same as they would on Amazon. Live Blue Dart keeps the manual
  // admin gate (packing takes real time there).
  const unshipped = await Order.find({ deliveryMethod: "HOME", status: { $in: ["PLACED", "CONFIRMED"] } })
    .select("_id")
    .lean();
  for (const o of unshipped) {
    if (await Shipment.exists({ order: o._id, direction: "FORWARD" })) continue;
    await createShipmentForOrder(String(o._id)).catch((err) => console.error(`auto-ship ${o._id} failed:`, err));
  }

  const active = await Shipment.find({
    status: { $in: ["PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"] },
  });

  for (const shipment of active) {
    const order = await Order.findById(shipment.order).lean();
    if (!order) continue;
    const city = order.shippingAddress?.city ?? "Destination";
    const destination =
      (order.shippingAddress?.pincode ? await geocodePincode(order.shippingAddress.pincode) : null) ?? WAREHOUSE;

    const steps = shipment.direction === "FORWARD" ? FORWARD_STEPS : REVERSE_STEPS;
    // Progress = how many simulator steps this shipment has already taken.
    const doneStatuses = await ShipmentEvent.countDocuments({
      shipment: shipment._id,
      status: { $in: ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"] },
    });
    const step = steps[doneStatuses];
    if (!step) continue;

    await transitionShipment(shipment, step.status, {
      location: step.label(city),
      description: step.description(city),
      coords: step.at(destination, WAREHOUSE),
    });
  }
}
