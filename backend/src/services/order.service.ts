import mongoose, { type HydratedDocument } from "mongoose";
import crypto from "node:crypto";
import { Cart } from "../models/Cart";
import { Product } from "../models/Product";
import { Coupon } from "../models/Coupon";
import { Order } from "../models/Order";
import { PickupAppointment } from "../models/PickupAppointment";
import { StoreLocation, DEFAULT_PICKUP_CONFIG, type StoreLocationDoc } from "../models/StoreLocation";
import { buildCartView } from "./cart.service";
import { sendEmail } from "../lib/mailer";
import { User } from "../models/User";

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
              loyaltyRedeemed: 0,
              total: view.totals.total,
            },
            coupon: couponId,
            deliveryMethod: input.deliveryMethod,
            shippingAddress: input.deliveryMethod === "HOME" ? input.address : undefined,
            storeLocation: store?._id,
            status: "PLACED",
          },
        ],
        { session }
      );
      orderId = String(order._id);

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

    // Confirmation email (mock logs in dev) — outside the transaction.
    const user = await User.findById(input.userId).select("email").lean();
    if (user) {
      const order = await Order.findById(orderId).lean();
      await sendEmail(
        user.email,
        `Your LuxeLoom order ${order?.orderNumber} is placed`,
        `Thanks for shopping with LuxeLoom. Order total: ₹${order?.pricing.total}. ${
          input.deliveryMethod === "PICKUP"
            ? `Pickup at ${store?.name} on ${input.appointment?.date}, ${input.appointment?.timeSlot}.`
            : "We'll email you when it ships."
        }`
      );
    }

    return Order.findById(orderId).populate("storeLocation", "name address city pincode").lean();
  } finally {
    await session.endSession();
  }
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
