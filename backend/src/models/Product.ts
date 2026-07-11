import { Schema, model, type InferSchemaType } from "mongoose";

const variantSchema = new Schema(
  {
    size: { type: String, required: true, trim: true },
    color: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: true }
);

// "accepted" = admin approved the Gemini-enhanced version; "original" = admin chose
// to keep the raw upload instead. A rejected enhancement is never persisted — the
// admin just re-runs or falls back to the original before the product is saved.
const productImageSchema = new Schema(
  {
    originalPublicId: { type: String, required: true },
    originalUrl: { type: String, required: true },
    enhancedPublicId: { type: String },
    enhancedUrl: { type: String },
    geminiModel: { type: String },
    status: { type: String, enum: ["accepted", "original"], required: true },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: true }
);

// Every component is stored, not just finalPrice, so margins can be recalculated
// later even if GST rates change (SPEC.md §4.2). gstRateLow/gstRateHigh/gstThreshold
// are snapshotted at save time from admin input (pre-filled from Settings for new
// products) so a later change to the store-wide defaults doesn't retroactively alter
// this product's historical pricing.
const pricingSchema = new Schema(
  {
    purchasePrice: { type: Number, required: true, min: 0 },
    fixedCost: { type: Number, required: true, min: 0 },
    marginPct: { type: Number, required: true, min: 0 },
    gstThreshold: { type: Number, required: true, min: 0 },
    gstRateLow: { type: Number, required: true, min: 0, max: 100 },
    gstRateHigh: { type: Number, required: true, min: 0, max: 100 },
    // Derived — recomputed server-side from the fields above on every save.
    baseCost: { type: Number, required: true, min: 0 },
    marginAmount: { type: Number, required: true, min: 0 },
    preTaxPrice: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, required: true, min: 0, max: 100 },
    gstAmount: { type: Number, required: true, min: 0 },
    finalPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, default: "" },
    category: { type: String, required: true, trim: true },
    tags: { type: [String], default: [] },
    stock: { type: Number, required: true, min: 0, default: 0 },
    variants: { type: [variantSchema], default: [] },
    pricing: { type: pricingSchema, required: true },
    images: { type: [productImageSchema], default: [] },
    status: { type: String, enum: ["draft", "published"], default: "draft", required: true },
  },
  { timestamps: true }
);

productSchema.index({ category: 1 });
productSchema.index({ status: 1 });

export type Product = InferSchemaType<typeof productSchema>;
export const ProductModel = model("Product", productSchema);
