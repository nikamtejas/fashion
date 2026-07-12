import crypto from "node:crypto";
import mongoose from "mongoose";
import { RefundRequest } from "../models/RefundRequest";
import { Order } from "../models/Order";
import { Payment } from "../models/Payment";
import { Product } from "../models/Product";
import { PickupAppointment } from "../models/PickupAppointment";
import { StoreLocation, DEFAULT_PICKUP_CONFIG } from "../models/StoreLocation";
import { ShipmentEvent } from "../models/ShipmentEvent";
import { Shipment } from "../models/Shipment";
import { getSettings } from "../models/Settings";
import { uploadImage } from "../lib/cloudinary";
import { refundPayment } from "../lib/integrations/razorpay";
import { cancelSnapmintOrder } from "../lib/integrations/snapmint";
import { notifyUser } from "./notify.service";
import { HttpError } from "./order.service";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ReturnItemInput {
  sku: string;
  qty: number;
}

export interface CreateReturnInput {
  userId: string;
  orderId: string;
  items: ReturnItemInput[];
  reason: string;
  photoDataUris?: string[];
  method: "COURIER" | "STORE";
  storeId?: string;
  appointment?: { date: string; timeSlot: string };
  bankDetails?: { accountName: string; accountNumber: string; ifsc: string };
}

async function deliveredAt(order: {
  _id: mongoose.Types.ObjectId;
  status: string;
  updatedAt?: Date;
  deliveryMethod: string;
}): Promise<Date | null> {
  if (order.status !== "DELIVERED") return null;
  const shipment = await Shipment.findOne({ order: order._id, direction: "FORWARD" }).select("_id").lean();
  if (shipment) {
    const event = await ShipmentEvent.findOne({ shipment: shipment._id, status: "DELIVERED" }).sort({ timestamp: -1 }).lean();
    if (event) return event.timestamp;
  }
  const appointment = await PickupAppointment.findOne({ order: order._id, type: "PICKUP", status: "COMPLETED" }).lean();
  if (appointment?.updatedAt) return appointment.updatedAt;
  return order.updatedAt ?? null;
}

export async function createReturnRequest(input: CreateReturnInput) {
  const order = await Order.findOne({ _id: input.orderId, user: input.userId });
  if (!order) throw new HttpError(404, "Order not found");
  if (order.status !== "DELIVERED") throw new HttpError(400, "Returns open once the order is delivered");

  const settings = await getSettings();
  const delivered = await deliveredAt(order);
  if (!delivered || Date.now() - delivered.getTime() > settings.returnWindowDays * 24 * 60 * 60 * 1000) {
    throw new HttpError(400, `The ${settings.returnWindowDays}-day return window for this order has closed`);
  }

  if (input.items.length === 0) throw new HttpError(400, "Pick at least one item to return");

  // Per-SKU eligibility: ordered qty minus anything already in an open or
  // completed return (rejected ones free the qty back up).
  const existing = await RefundRequest.find({ order: order._id, status: { $ne: "REJECTED" } }).lean();
  const alreadyRequested = new Map<string, number>();
  for (const r of existing) {
    for (const item of r.items) {
      alreadyRequested.set(item.sku, (alreadyRequested.get(item.sku) ?? 0) + item.qty);
    }
  }

  let itemsValue = 0;
  const items: { product: mongoose.Types.ObjectId; sku: string; qty: number }[] = [];
  for (const req of input.items) {
    const ordered = order.items.find((i) => i.sku === req.sku);
    if (!ordered) throw new HttpError(400, `${req.sku} isn't part of this order`);
    const remaining = ordered.qty - (alreadyRequested.get(req.sku) ?? 0);
    if (req.qty < 1 || req.qty > remaining) {
      throw new HttpError(400, `Only ${remaining} of ${ordered.name} can still be returned`);
    }
    itemsValue += ordered.price * req.qty;
    items.push({ product: ordered.product, sku: req.sku, qty: req.qty });
  }

  // Refund proportionally shares the coupon discount; shipping/COD fees stay.
  const discountShare = order.pricing.subtotal > 0 ? order.pricing.discount / order.pricing.subtotal : 0;
  const refundAmount = round2(itemsValue * (1 - discountShare));

  const payment = await Payment.findOne({ order: order._id }).lean();
  if (payment?.method === "COD") {
    const b = input.bankDetails;
    if (!b?.accountName || !b?.accountNumber || !b?.ifsc) {
      throw new HttpError(400, "COD refunds are paid to your bank account — add your account details");
    }
  }

  const photos: { publicId: string; secureUrl: string }[] = [];
  for (const dataUri of input.photoDataUris ?? []) {
    const uploaded = await uploadImage(dataUri, { folder: `luxeloom/returns/${order.orderNumber}` });
    photos.push({ publicId: uploaded.publicId, secureUrl: uploaded.secureUrl });
  }

  let appointmentId: mongoose.Types.ObjectId | undefined;
  let storeId: mongoose.Types.ObjectId | undefined;
  if (input.method === "STORE") {
    if (!input.storeId || !input.appointment) throw new HttpError(400, "Pick a store and drop-off slot");
    const store = await StoreLocation.findById(input.storeId).lean();
    if (!store || !store.active) throw new HttpError(404, "Store not found");

    const config = store.pickupConfig ?? DEFAULT_PICKUP_CONFIG;
    const windows = config.windows?.length ? config.windows : DEFAULT_PICKUP_CONFIG.windows;
    if (!windows.some((w) => `${w.start}-${w.end}` === input.appointment!.timeSlot)) {
      throw new HttpError(400, "That time slot doesn't exist for this store");
    }
    const dayStart = new Date(`${input.appointment.date}T00:00:00`);
    const dayEnd = new Date(`${input.appointment.date}T23:59:59`);
    const booked = await PickupAppointment.countDocuments({
      storeLocation: store._id,
      date: { $gte: dayStart, $lte: dayEnd },
      timeSlot: input.appointment.timeSlot,
      status: { $in: ["BOOKED", "READY"] },
    });
    if (booked >= (config.capacityPerSlot ?? DEFAULT_PICKUP_CONFIG.capacityPerSlot)) {
      throw new HttpError(409, "That slot just filled up — pick another");
    }

    const appointment = await PickupAppointment.create({
      order: order._id,
      type: "RETURN",
      storeLocation: store._id,
      date: new Date(`${input.appointment.date}T00:00:00`),
      timeSlot: input.appointment.timeSlot,
      status: "BOOKED",
      qrCode: crypto.randomBytes(6).toString("hex").toUpperCase(),
    });
    appointmentId = appointment._id;
    storeId = store._id;
  }

  const refund = await RefundRequest.create({
    order: order._id,
    items,
    reason: input.reason,
    photos,
    method: input.method,
    status: "REQUESTED",
    refundAmount,
    storeLocation: storeId,
    appointment: appointmentId,
    bankDetails: payment?.method === "COD" ? input.bankDetails : undefined,
  });

  await notifyUser(
    input.userId,
    `Return requested — order ${order.orderNumber}`,
    input.method === "STORE"
      ? "Your drop-off slot is booked. We'll review your request shortly — refunds are instant once the store checks the item."
      : "We'll review your request shortly and schedule a reverse pickup once approved.",
    `/account/orders/${order._id}`
  );

  return refund;
}

export async function approveReturn(refundId: string) {
  const refund = await RefundRequest.findById(refundId);
  if (!refund) throw new HttpError(404, "Return request not found");
  if (refund.status !== "REQUESTED") throw new HttpError(400, `Already ${refund.status}`);

  refund.status = "APPROVED";

  if (refund.method === "COURIER") {
    const { createReverseShipment } = await import("./shipment.service.js");
    const shipment = await createReverseShipment(String(refund.order));
    refund.reverseShipment = shipment._id;
  }
  await refund.save();

  const order = await Order.findById(refund.order).lean();
  if (order) {
    await notifyUser(
      String(order.user),
      `Return approved — order ${order.orderNumber}`,
      refund.method === "COURIER"
        ? "A reverse pickup has been scheduled. Keep the items packed and ready."
        : "Show your return QR code at the store — your refund is processed on the spot after a quick check.",
      `/account/orders/${order._id}`
    );
  }
  return refund;
}

export async function rejectReturn(refundId: string, reason: string) {
  const refund = await RefundRequest.findById(refundId);
  if (!refund) throw new HttpError(404, "Return request not found");
  if (!["REQUESTED", "APPROVED"].includes(refund.status)) throw new HttpError(400, `Already ${refund.status}`);

  refund.status = "REJECTED";
  refund.rejectionReason = reason;
  await refund.save();

  if (refund.appointment) {
    await PickupAppointment.updateOne({ _id: refund.appointment, status: { $in: ["BOOKED", "READY"] } }, { status: "CANCELLED" });
  }

  const order = await Order.findById(refund.order).lean();
  if (order) {
    await notifyUser(String(order.user), `Return declined — order ${order.orderNumber}`, reason, `/account/orders/${order._id}`);
  }
  return refund;
}

/** Store staff scan the customer's return QR, inspect, and pass/fail QC on
 * the spot. Pass = instant refund ("refund in minutes at a store near you"). */
export async function storeQc(refundId: string, opts: { qrCode: string; pass: boolean; notes?: string }) {
  const refund = await RefundRequest.findById(refundId);
  if (!refund) throw new HttpError(404, "Return request not found");
  if (refund.method !== "STORE") throw new HttpError(400, "This return isn't a store drop-off");
  if (!["REQUESTED", "APPROVED"].includes(refund.status)) throw new HttpError(400, `Already ${refund.status}`);

  const appointment = refund.appointment ? await PickupAppointment.findById(refund.appointment) : null;
  if (!appointment) throw new HttpError(400, "No drop-off appointment on this return");
  if (appointment.qrCode !== opts.qrCode.toUpperCase().trim()) {
    throw new HttpError(400, "Return code doesn't match");
  }

  appointment.status = "COMPLETED";
  await appointment.save();

  refund.qcNotes = opts.notes;
  if (!opts.pass) {
    refund.status = "REJECTED";
    refund.rejectionReason = opts.notes ?? "Failed in-store quality check";
    await refund.save();
    const order = await Order.findById(refund.order).lean();
    if (order) {
      await notifyUser(String(order.user), `Return declined — order ${order.orderNumber}`, refund.rejectionReason, `/account/orders/${order._id}`);
    }
    return refund;
  }

  refund.status = "RECEIVED";
  await refund.save();
  // markDroppedAtStore is implicit in RECEIVED here — the tracker shows
  // "Dropped at store" and "Received" as one instant for store returns.
  return processRefund(String(refund._id), { instant: true });
}

/** Executes the actual money movement per original payment rail, restores
 * stock, and closes the request as REFUNDED. */
export async function processRefund(refundId: string, opts: { instant?: boolean } = {}) {
  const refund = await RefundRequest.findById(refundId);
  if (!refund) throw new HttpError(404, "Return request not found");
  if (refund.status === "REFUNDED") return refund;
  if (!["RECEIVED", "APPROVED", "ITEM_PICKED_UP"].includes(refund.status)) {
    throw new HttpError(400, `Can't refund a ${refund.status} return`);
  }

  const order = await Order.findById(refund.order);
  if (!order) throw new HttpError(404, "Order not found");
  const payment = await Payment.findOne({ order: order._id });
  const amount = refund.refundAmount ?? 0;

  let creditDays = 5;
  if (payment?.method === "RAZORPAY" && payment.razorpayPaymentId) {
    await refundPayment(payment.razorpayPaymentId, amount);
  } else if (payment?.method === "SNAPMINT" && payment.snapmintPlan?.snapmintOrderId) {
    await cancelSnapmintOrder(payment.snapmintPlan.snapmintOrderId);
    creditDays = 7;
  } else {
    // COD: manual bank payout to refund.bankDetails (mock-logged).
    creditDays = 3;
  }
  if (opts.instant) creditDays = 0;

  // Returned items go back into sellable stock.
  for (const item of refund.items) {
    await Product.updateOne(
      { _id: item.product },
      { $inc: { "variants.$[v].stock": item.qty } },
      { arrayFilters: [{ "v.sku": item.sku }] }
    );
  }

  if (payment && amount >= payment.amount) {
    payment.status = "REFUNDED";
    await payment.save();
  }

  refund.status = "REFUNDED";
  refund.expectedCreditDate = new Date(Date.now() + creditDays * 24 * 60 * 60 * 1000);
  await refund.save();

  await notifyUser(
    String(order.user),
    `Refund of ₹${amount.toLocaleString("en-IN")} processed`,
    creditDays === 0
      ? "Your refund has been processed — it should reflect within minutes."
      : `Expect the credit by ${refund.expectedCreditDate.toLocaleDateString("en-IN")}.`,
    `/account/orders/${order._id}`
  );

  return refund;
}
