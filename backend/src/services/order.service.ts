import mongoose, { type HydratedDocument } from "mongoose";
import crypto from "node:crypto";
import { Cart } from "../models/Cart";
import { Product } from "../models/Product";
import { Coupon } from "../models/Coupon";
import { Order } from "../models/Order";
import { Payment } from "../models/Payment";
import { PickupAppointment } from "../models/PickupAppointment";
import { StoreLocation, DEFAULT_PICKUP_CONFIG, type StoreLocationDoc } from "../models/StoreLocation";
import { buildCartView } from "./cart.service";
import { sendEmail } from "../lib/mailer";
import { User } from "../models/User";
import { getSettings } from "../models/Settings";
import { env } from "../config/env";
import { renderOrderConfirmationA4, pdfToBuffer } from "./invoice.service";
import { refundPayment } from "../lib/integrations/razorpay";
import { cancelSnapmintOrder } from "../lib/integrations/snapmint";
import { Shipment } from "../models/Shipment";
import { notifyUser } from "./notify.service";
import { orderSubject } from "../lib/orderSubject";

export interface AddressInput {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface PlaceOrderInput {
  userId: string;
  deliveryMethod: "HOME" | "PICKUP";
  address?: AddressInput;
  storeId?: string;
  appointment?: { date: string; timeSlot: string };
  /** M5: which payment rail this order will settle on. */
  paymentMethod: "RAZORPAY" | "COD" | "SNAPMINT";
  /** COD convenience fee (from Settings) added as its own pricing line. */
  codFee?: number;
  /**
   * PENDING_PAYMENT reserves stock while an online payment completes (the
   * 15-minute cleanup releases it on abandonment); PLACED is for COD which
   * confirms immediately after its OTP.
   */
  initialStatus: "PENDING_PAYMENT" | "PLACED";
  /** Loyalty points to redeem (1 point = ₹1), spent inside the transaction. */
  loyaltyPoints?: number;
}

function generateOrderNumber(): string {
  return `LL-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

/**
 * Places the order atomically: per-line stock decrement (guarded so
 * oversells abort), coupon consumption, order creation, appointment
 * creation (pickup) and cart clearing all commit or roll back together.
 * The cart is recomputed fresh inside this call — client totals are never
 * trusted.
 */
export async function placeOrder(input: PlaceOrderInput) {
  const view = await buildCartView(input.userId);
  if (view.items.length === 0) throw new HttpError(400, "Your bag is empty");

  if (input.deliveryMethod === "HOME" && !input.address) {
    throw new HttpError(400, "A delivery address is required");
  }

  let store: HydratedDocument<StoreLocationDoc> | null = null;
  if (input.deliveryMethod === "PICKUP") {
    if (!input.storeId || !input.appointment) {
      throw new HttpError(400, "Pick a store and appointment slot");
    }
    store = await StoreLocation.findById(input.storeId);
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
  }

  const session = await mongoose.startSession();
  try {
    let orderId: string | undefined;
    await session.withTransaction(async () => {
      // 1. Atomic stock decrement per line; abort the whole order if short.
      // $elemMatch is load-bearing: with separate "variants.sku" and
      // "variants.stock" clauses the positional $ can resolve to a
      // DIFFERENT variant that satisfied only one clause and decrement
      // the wrong SKU's stock (observed in testing, not hypothetical).
      for (const item of view.items) {
        const result = await Product.updateOne(
          { _id: item.productId, variants: { $elemMatch: { sku: item.sku, stock: { $gte: item.qty } } } },
          { $inc: { "variants.$.stock": -item.qty } },
          { session }
        );
        if (result.modifiedCount === 0) {
          throw new HttpError(409, `${item.name} (${item.size}) just went out of stock`);
        }
      }

      // 2. Consume the coupon.
      let couponId: mongoose.Types.ObjectId | undefined;
      if (view.coupon) {
        const coupon = await Coupon.findOne({ code: view.coupon.code }).session(session);
        if (coupon) {
          coupon.usedCount += 1;
          await coupon.save({ session });
          couponId = coupon._id;
        }
      }

      // 3. Create the order with full snapshots.
      const orderNumber = generateOrderNumber();
      const codFee = input.paymentMethod === "COD" ? (input.codFee ?? 0) : 0;

      // Loyalty redemption (1 point = ₹1), capped so at least ₹1 remains
      // payable — payment rails reject zero-value orders.
      const preLoyaltyTotal = Math.round((view.totals.total + codFee) * 100) / 100;
      const loyaltyRedeemed = Math.min(Math.max(0, Math.floor(input.loyaltyPoints ?? 0)), Math.max(0, Math.floor(preLoyaltyTotal - 1)));
      if (loyaltyRedeemed > 0) {
        const { redeemPoints } = await import("./loyalty.service.js");
        // Order id doesn't exist yet — record against the order after create.
        await redeemPoints(input.userId, loyaltyRedeemed, null, session);
      }
      const total = Math.round((preLoyaltyTotal - loyaltyRedeemed) * 100) / 100;
      const [order] = await Order.create(
        [
          {
            orderNumber,
            user: input.userId,
            items: view.items.map((i) => ({
              product: i.productId,
              sku: i.sku,
              name: i.name,
              image: i.image ?? undefined,
              size: i.size,
              color: i.color,
              price: i.unitPrice,
              qty: i.qty,
            })),
            pricing: {
              subtotal: view.totals.subtotal,
              discount: view.totals.discount,
              gst: view.totals.gst,
              shipping: view.totals.shipping,
              codFee,
              loyaltyRedeemed,
              total,
            },
            coupon: couponId,
            deliveryMethod: input.deliveryMethod,
            shippingAddress: input.deliveryMethod === "HOME" ? input.address : undefined,
            storeLocation: store?._id,
            status: input.initialStatus,
          },
        ],
        { session }
      );
      orderId = String(order._id);

      // 3b. The payment record rides in the same transaction so an order
      // can never exist without its payment (and vice versa).
      const [payment] = await Payment.create(
        [{ order: order._id, method: input.paymentMethod, status: "PENDING", amount: total, codConvenienceFee: codFee }],
        { session }
      );
      order.payment = payment._id;
      await order.save({ session });

      // 4. Pickup appointment with its QR code.
      if (input.deliveryMethod === "PICKUP" && store && input.appointment) {
        const [appointment] = await PickupAppointment.create(
          [
            {
              order: order._id,
              storeLocation: store._id,
              date: new Date(`${input.appointment.date}T00:00:00`),
              timeSlot: input.appointment.timeSlot,
              status: "BOOKED",
              qrCode: crypto.randomBytes(6).toString("hex").toUpperCase(),
            },
          ],
          { session }
        );
        void appointment;
      }

      // 5. Clear the cart.
      await Cart.updateOne({ user: input.userId }, { $set: { items: [], coupon: undefined } }, { session });
    });

    // Confirmation email (mock logs in dev) — outside the transaction, and
    // only for immediately-confirmed orders. Online payments email after
    // successful verification instead.
    if (input.initialStatus === "PLACED") {
      await sendOrderConfirmationEmail(orderId!);
    }

    return Order.findById(orderId).populate("storeLocation", "name address city pincode").lean();
  } finally {
    await session.endSession();
  }
}

export async function sendOrderConfirmationEmail(orderId: string) {
  const order = await Order.findById(orderId).populate("storeLocation", "name").lean();
  if (!order) return;
  const user = await User.findById(order.user).select("email name").lean();
  if (!user) return;
  const appointment =
    order.deliveryMethod === "PICKUP" ? await PickupAppointment.findOne({ order: order._id }).lean() : null;
  const settings = await getSettings();

  const storeName = (order.storeLocation as unknown as { name?: string })?.name;
  const nextStep = appointment
    ? `Your pieces will be ready at ${storeName} on ${appointment.date.toISOString().slice(0, 10)} between ${appointment.timeSlot}. Bring a photo ID — your pickup QR code is on your order page.`
    : "We're preparing your pieces now — you'll get tracking details the moment your order ships.";

  // Attach the confirmation PDF; the email still goes out if rendering fails.
  let attachments: { filename: string; content: Buffer }[] | undefined;
  try {
    const doc = await renderOrderConfirmationA4({
      order,
      customer: { name: user.name, email: user.email },
      pickup: appointment
        ? { storeName, date: appointment.date.toISOString().slice(0, 10), timeSlot: appointment.timeSlot }
        : null,
    });
    attachments = [{ filename: `LuxeLoom-${order.orderNumber}-confirmation.pdf`, content: await pdfToBuffer(doc) }];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("confirmation email: PDF failed:", err);
  }

  const itemLines = order.items.map((i) => `  · ${i.name}${i.size ? ` (${i.size}${i.color ? `, ${i.color}` : ""})` : ""} × ${i.qty}`);

  await sendEmail(
    user.email,
    orderSubject("Order confirmed", order.orderNumber, order.items),
    [
      `Thank you for choosing LuxeLoom — your order ${order.orderNumber} is confirmed and in caring hands.`,
      ``,
      ...itemLines,
      ``,
      `Total paid: ₹${order.pricing.total.toLocaleString("en-IN")}`,
      ``,
      nextStep,
      ``,
      `Every piece is quality-checked by hand before it leaves us. Changed your mind? No stress — easy returns within ${settings.returnWindowDays} days, right from your orders page.`,
      ``,
      `Track your order anytime: ${env.frontendUrl}/account/orders`,
      ``,
      `Your order confirmation is attached as a PDF for your records.`,
    ].join("\n"),
    { heading: "Your order is confirmed", attachments }
  );
}

/**
 * Releases stock reserved by online-payment orders that never completed:
 * any PENDING_PAYMENT order older than 15 minutes is cancelled, its stock
 * restored, its coupon un-consumed and its payment marked FAILED. Runs on
 * the server's sweep interval.
 */
export const PAYMENT_RESERVATION_TTL_MS = 15 * 60 * 1000;

export async function releaseStaleReservations(now = new Date()) {
  const cutoff = new Date(now.getTime() - PAYMENT_RESERVATION_TTL_MS);
  const stale = await Order.find({ status: "PENDING_PAYMENT", createdAt: { $lt: cutoff } });

  for (const order of stale) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const item of order.items) {
          await Product.updateOne(
            { _id: item.product, "variants.sku": item.sku },
            { $inc: { "variants.$[v].stock": item.qty } },
            { arrayFilters: [{ "v.sku": item.sku }], session }
          );
        }
        if (order.coupon) {
          await Coupon.updateOne({ _id: order.coupon, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }, { session });
        }
        if (order.pricing.loyaltyRedeemed > 0) {
          const { LoyaltyAccount } = await import("../models/LoyaltyAccount.js");
          await LoyaltyAccount.updateOne(
            { user: order.user },
            {
              $inc: { points: order.pricing.loyaltyRedeemed },
              $push: { history: { type: "EARN", points: order.pricing.loyaltyRedeemed, order: order._id, date: new Date() } },
            },
            { session }
          );
        }
        order.status = "CANCELLED";
        await order.save({ session });
        await Payment.updateOne({ order: order._id, status: "PENDING" }, { status: "FAILED" }, { session });
        await PickupAppointment.updateOne(
          { order: order._id, status: { $in: ["BOOKED", "READY"] } },
          { status: "CANCELLED" },
          { session }
        );
      });
      // eslint-disable-next-line no-console
      console.log(`[payments] released stale reservation for order ${order.orderNumber}`);
    } finally {
      await session.endSession();
    }
  }
}

const CANCELLABLE_STATUSES = [
  "PLACED",
  "CONFIRMED",
  "PACKED",
  "PICKUP_SCHEDULED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
] as const;

export type CancelledBy = "CUSTOMER" | "ADMIN";

/**
 * Cancels an order pre-fulfillment and reverses everything placeOrder did:
 * restores stock, un-consumes the coupon, refunds redeemed loyalty points,
 * cancels a linked pickup appointment, and refunds captured payment via the
 * original rail. Shared by the customer pickup-cancel route and the admin
 * bulk-status CANCELLED path so both delivery methods behave identically —
 * neither had a working refund before this.
 */
export async function cancelOrder(orderId: string, opts: { reason: string; cancelledBy: CancelledBy }) {
  const order = await Order.findById(orderId);
  if (!order) throw new HttpError(404, "Order not found");
  if (!(CANCELLABLE_STATUSES as readonly string[]).includes(order.status)) {
    throw new HttpError(400, `Order is already ${order.status.replaceAll("_", " ").toLowerCase()} and can't be cancelled`);
  }

  const payment = await Payment.findOne({ order: order._id });

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const item of order.items) {
        await Product.updateOne(
          { _id: item.product, "variants.sku": item.sku },
          { $inc: { "variants.$[v].stock": item.qty } },
          { arrayFilters: [{ "v.sku": item.sku }], session }
        );
      }
      if (order.coupon) {
        await Coupon.updateOne({ _id: order.coupon, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }, { session });
      }
      if (order.pricing.loyaltyRedeemed > 0) {
        const { LoyaltyAccount } = await import("../models/LoyaltyAccount.js");
        await LoyaltyAccount.updateOne(
          { user: order.user },
          {
            $inc: { points: order.pricing.loyaltyRedeemed },
            $push: { history: { type: "EARN", points: order.pricing.loyaltyRedeemed, order: order._id, date: new Date() } },
          },
          { session }
        );
      }
      order.status = "CANCELLED";
      order.cancelReason = opts.reason;
      order.cancelledAt = new Date();
      order.cancelledBy = opts.cancelledBy;
      await order.save({ session });
      await PickupAppointment.updateOne(
        { order: order._id, status: { $in: ["BOOKED", "READY"] } },
        { status: "CANCELLED" },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  // A HOME order with an in-flight courier shipment needs that shipment
  // stopped too — otherwise the mock simulator (or a live Blue Dart
  // tracking update) keeps advancing it, and transitionShipment's own
  // CANCELLED guard only stops it from corrupting Order.status, not from
  // reporting further checkpoints. RTO is the honest state: the parcel is
  // physically on its way back.
  if (order.deliveryMethod === "HOME") {
    const shipment = await Shipment.findOne({
      order: order._id,
      direction: "FORWARD",
      status: { $in: ["PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"] },
    });
    if (shipment) {
      const { transitionShipment } = await import("./shipment.service.js");
      await transitionShipment(shipment, "RTO", { description: "Order cancelled — parcel is being returned to origin" });
    }
  }

  // Money movement happens outside the transaction — refund calls are
  // external requests and shouldn't hold a DB transaction open.
  let refundMessage: string | null = null;
  if (payment?.status === "PAID") {
    if (payment.method === "RAZORPAY" && payment.razorpayPaymentId) {
      await refundPayment(payment.razorpayPaymentId, order.pricing.total);
      payment.status = "REFUNDED";
      refundMessage = "Your refund has been processed — it should reflect within minutes.";
    } else if (payment.method === "SNAPMINT" && payment.snapmintPlan?.snapmintOrderId) {
      await cancelSnapmintOrder(payment.snapmintPlan.snapmintOrderId);
      payment.status = "REFUNDED";
      refundMessage = "Your EMI plan has been cancelled — any instalments already paid will be refunded within 5-7 business days.";
    } else {
      // COD/CASH/UPI/CARD: cash was already collected (counter handover or
      // door collection), and there's no refund API for it — hold at
      // REFUND_PENDING until the customer supplies a bank account and an
      // admin pays it out (see payments.routes.ts refund-bank-details and
      // adminOrders.routes.ts mark-refund-paid).
      payment.status = "REFUND_PENDING";
      refundMessage =
        "We'll refund this to your bank account — add your account details from your order page and we'll pay it out within 3-5 business days of receiving them.";
    }
    await payment.save();
  } else if (payment?.status === "PENDING") {
    // Nothing was ever captured — void the intent, nothing to refund.
    payment.status = "FAILED";
    await payment.save();
  }

  await notifyUser(
    String(order.user),
    orderSubject("Order cancelled", order.orderNumber, order.items),
    refundMessage ? `Your order has been cancelled. ${refundMessage}` : "Your order has been cancelled.",
    `/account/orders/${order._id}`
  );

  return order;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
