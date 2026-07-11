import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const CouponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    type: { type: String, enum: ["FLAT", "PERCENTAGE"], required: true },
    value: { type: Number, required: true },
    maxDiscount: { type: Number }, // cap for PERCENTAGE coupons
    minOrderValue: { type: Number, default: 0 },
    usageLimit: { type: Number }, // global cap, undefined = unlimited
    perUserLimit: { type: Number, default: 1 },
    usedCount: { type: Number, default: 0 },
    expiresAt: { type: Date },
    applicableCategories: { type: [Schema.Types.ObjectId], ref: "Category", default: [] },
    applicableProducts: { type: [Schema.Types.ObjectId], ref: "Product", default: [] },
    firstOrderOnly: { type: Boolean, default: false },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export type CouponDoc = InferSchemaType<typeof CouponSchema>;

export const Coupon: Model<CouponDoc> = models.Coupon ?? model<CouponDoc>("Coupon", CouponSchema);
