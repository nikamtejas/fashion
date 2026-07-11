import mongoose from "mongoose";
import { CartModel } from "../models/Cart.js";
import { ProductModel } from "../models/Product.js";
import { CouponModel } from "../models/Coupon.js";
import { OrderModel, type Order } from "../models/Order.js";
import { computeCartLines } from "./cart.service.js";
import { validateCouponForCart } from "../utils/coupon.js";
import { ApiError } from "../utils/ApiError.js";

export interface PlaceOrderInput {
  userId: string;
  paymentMethod: "razorpay" | "cod";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpayMethod?: string;
  shippingAddress: { line1: string; line2?: string; city: string; state: string; pincode: string };
  whatsappNumber?: string;
}

// Wraps the whole checkout commit in a Mongo transaction (Atlas replica sets support
// multi-document ACID transactions) so a partial failure — insufficient stock on the
// third item, say — can't leave stock decremented for the first two without an order
// to show for it. Known simplification: for the Razorpay path, the amount actually
// charged was locked in when the Razorpay order was created (see razorpay.service.ts);
// this recomputes the cart total fresh at commit time rather than re-verifying it
// against the charged amount, so a cart/coupon change in the few seconds during
// checkout could theoretically produce an order total that doesn't exactly match what
// Razorpay captured. A production hardening pass would fetch the Razorpay payment and
// compare, refunding on mismatch — not built here as it's outside M5's core scope.
export async function placeOrder(input: PlaceOrderInput): Promise<Order & { _id: unknown }> {
  const session = await mongoose.startSession();
  try {
    let order: (Order & { _id: unknown }) | undefined;

    await session.withTransaction(async () => {
      const cart = await CartModel.findOne({ userId: input.userId }).session(session);
      if (!cart || cart.items.length === 0) {
        throw new ApiError(400, "Your cart is empty");
      }

      const { lines, subtotal } = await computeCartLines(cart, session);
      if (lines.length === 0) {
        throw new ApiError(400, "Your cart is empty");
      }

      let discount = 0;
      let couponCode: string | undefined;
      if (cart.couponCode) {
        const couponDoc = await CouponModel.findOne({ code: cart.couponCode }).session(session);
        const result = couponDoc
          ? validateCouponForCart(
              couponDoc,
              lines.map((l) => ({ category: l.category })),
              subtotal
            )
          : ({ valid: false, reason: "Coupon no longer exists" } as const);

        if (result.valid && couponDoc) {
          discount = result.discount;
          couponCode = couponDoc.code;
          await CouponModel.updateOne({ _id: couponDoc._id }, { $inc: { usedCount: 1 } }).session(session);
        }
      }

      // Atomic per-document stock decrement, gated on enough stock still being
      // available — if any line comes up short, this throws and the whole
      // transaction (including any earlier decrements in this loop) rolls back.
      for (const line of lines) {
        const filter: Record<string, unknown> = line.variantSku
          ? { _id: line.productId, "variants.sku": line.variantSku, "variants.stock": { $gte: line.qty } }
          : { _id: line.productId, stock: { $gte: line.qty } };
        const update = line.variantSku
          ? { $inc: { "variants.$.stock": -line.qty } }
          : { $inc: { stock: -line.qty } };
        const result = await ProductModel.updateOne(filter, update).session(session);
        if (result.matchedCount === 0) {
          throw new ApiError(400, `${line.productName} no longer has enough stock`);
        }
      }

      const total = subtotal - discount;

      const [createdOrder] = await OrderModel.create(
        [
          {
            userId: input.userId,
            items: lines.map((l) => ({
              productId: l.productId,
              variantSku: l.variantSku,
              name: l.productName,
              size: l.size,
              color: l.color,
              price: l.unitPrice,
              qty: l.qty,
            })),
            subtotal,
            couponCode,
            discount,
            total,
            payment: {
              method: input.paymentMethod,
              status: input.paymentMethod === "razorpay" ? "captured" : "pending",
              razorpayOrderId: input.razorpayOrderId,
              razorpayPaymentId: input.razorpayPaymentId,
              razorpayMethod: input.razorpayMethod,
            },
            shippingAddress: input.shippingAddress,
            whatsappNumber: input.whatsappNumber,
            status: "confirmed",
          },
        ],
        { session }
      );
      order = createdOrder;

      cart.items.splice(0, cart.items.length);
      cart.couponCode = undefined;
      await cart.save({ session });
    });

    if (!order) {
      throw new ApiError(500, "Order could not be created");
    }
    return order;
  } finally {
    await session.endSession();
  }
}
