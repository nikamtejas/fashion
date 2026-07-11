import { Schema, model, type InferSchemaType } from "mongoose";

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ["flat", "percentage"], required: true },
    value: { type: Number, required: true, min: 0 },
    // Only meaningful for type "percentage" — caps the discount in currency.
    maxDiscount: { type: Number, min: 0 },
    minCartValue: { type: Number, min: 0, default: 0 },
    expiresAt: { type: Date },
    // Total redemptions allowed across all customers. usedCount is incremented at
    // order placement (Milestone 5) — applying a coupon to a cart doesn't consume it,
    // since carts can be abandoned.
    usageLimit: { type: Number, min: 0 },
    usedCount: { type: Number, min: 0, default: 0 },
    // Empty = applies to every category. Per-product restriction is deferred — not
    // needed for the milestone's "apply a coupon end-to-end" scope.
    applicableCategories: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type Coupon = InferSchemaType<typeof couponSchema>;
export const CouponModel = model("Coupon", couponSchema);
