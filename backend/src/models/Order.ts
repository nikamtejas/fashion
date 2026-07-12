import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const OrderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String },
    size: { type: String },
    color: { type: String },
    price: { type: Number, required: true },
    qty: { type: Number, required: true },
  },
  { _id: false }
);

const AddressSnapshotSchema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true, index: true },
    country: { type: String, default: "India" },
    lat: { type: Number },
    lng: { type: Number },
  },
  { _id: false }
);

const OrderPricingSchema = new Schema(
  {
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    codFee: { type: Number, default: 0 },
    loyaltyRedeemed: { type: Number, default: 0 },
    total: { type: Number, required: true },
  },
  { _id: false }
);

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PLACED",
  "CONFIRMED",
  "PACKED",
  "PICKUP_SCHEDULED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RTO",
] as const;

const OrderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [OrderItemSchema], default: [] },
    pricing: { type: OrderPricingSchema, required: true },
    coupon: { type: Schema.Types.ObjectId, ref: "Coupon" },
    deliveryMethod: { type: String, enum: ["HOME", "PICKUP"], required: true },
    shippingAddress: { type: AddressSnapshotSchema },
    storeLocation: { type: Schema.Types.ObjectId, ref: "StoreLocation" },
    payment: { type: Schema.Types.ObjectId, ref: "Payment" },
    status: { type: String, enum: ORDER_STATUSES, default: "PLACED", index: true },
    notes: { type: String },
  },
  { timestamps: true }
);

export type OrderDoc = InferSchemaType<typeof OrderSchema>;

export const Order: Model<OrderDoc> = models.Order ?? model<OrderDoc>("Order", OrderSchema);
