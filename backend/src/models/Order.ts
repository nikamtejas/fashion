import { Schema, model, type InferSchemaType } from "mongoose";

// Snapshotted at order time — unlike Cart, an Order must never change its recorded
// price/name even if the product is later edited or deleted.
const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantSku: { type: String },
    name: { type: String, required: true },
    size: { type: String },
    color: { type: String },
    price: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const addressSchema = new Schema(
  {
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    couponCode: { type: String },
    discount: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    payment: {
      method: { type: String, enum: ["razorpay", "cod"], required: true },
      status: { type: String, enum: ["pending", "captured", "failed"], required: true, default: "pending" },
      razorpayOrderId: { type: String },
      razorpayPaymentId: { type: String },
      // Whatever underlying method Razorpay reports back (card/upi/netbanking/wallet/
      // emi/...) once the payment is verified. Snapmint EMI rides inside Razorpay
      // Standard Checkout once enabled on the account (SPEC.md §4.4) — there is no
      // separate Snapmint integration, so this field is where its usage would show up,
      // under whatever method string Razorpay assigns it.
      razorpayMethod: { type: String },
    },
    shippingAddress: { type: addressSchema, required: true },
    whatsappNumber: { type: String },
    // Placeholder for Milestone 6 (DHL shipping) — status defaults to "pending" until
    // a shipment is actually created.
    shipping: {
      dhlTrackingId: { type: String },
      status: { type: String, default: "pending" },
    },
    // Placeholder for Milestone 7 (order confirmation email).
    confirmationEmailSentAt: { type: Date },
    status: {
      type: String,
      enum: ["placed", "confirmed", "shipped", "delivered", "cancelled", "returned"],
      required: true,
      default: "placed",
    },
  },
  { timestamps: true }
);

orderSchema.index({ userId: 1 });
orderSchema.index({ status: 1 });

export type Order = InferSchemaType<typeof orderSchema>;
export const OrderModel = model("Order", orderSchema);
