import { Schema, model, type InferSchemaType } from "mongoose";

const cartItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    // Absent when the product has no variants.
    variantSku: { type: String },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: true }
);

// One cart per logged-in user (SPEC.md scopes cart to logged-in customers only, not
// guests). Line items intentionally don't snapshot price/name — those are looked up
// live from the Product at read time so the cart never shows a stale price; only an
// actual order (Milestone 5) snapshots pricing.
const cartSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
    couponCode: { type: String },
  },
  { timestamps: true }
);

export type Cart = InferSchemaType<typeof cartSchema>;
export const CartModel = model("Cart", cartSchema);

export async function getOrCreateCart(userId: string) {
  const existing = await CartModel.findOne({ userId });
  if (existing) return existing;
  return CartModel.create({ userId, items: [] });
}
