import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// One cart per logged-in user. Lines store only identity + qty — price,
// name and image are always looked up live from the current Product at
// read time so the cart never shows a stale price. Only a placed Order
// snapshots pricing. (Same deliberate design as the coupon reference:
// applying a coupon to a cart never consumes it; order placement does.)
const CartLineSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sku: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const SavedLineSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sku: { type: String, required: true },
  },
  { _id: false }
);

const CartSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    items: { type: [CartLineSchema], default: [] },
    savedItems: { type: [SavedLineSchema], default: [] },
    coupon: { type: Schema.Types.ObjectId, ref: "Coupon" },
  },
  { timestamps: true }
);

export type CartDoc = InferSchemaType<typeof CartSchema>;

export const Cart: Model<CartDoc> = models.Cart ?? model<CartDoc>("Cart", CartSchema);
