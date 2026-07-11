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

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, default: "" },
    category: { type: String, required: true, trim: true },
    tags: { type: [String], default: [] },
    stock: { type: Number, required: true, min: 0, default: 0 },
    variants: { type: [variantSchema], default: [] },
    // M2 placeholder for a manually-entered price. Milestone 3 replaces this with a
    // computed pricing breakdown (purchasePrice, fixedCost, marginPct, GST, finalPrice)
    // stored as its own sub-document, per SPEC.md §4.2/§5.
    price: { type: Number, required: true, min: 0 },
    images: { type: [productImageSchema], default: [] },
    status: { type: String, enum: ["draft", "published"], default: "draft", required: true },
  },
  { timestamps: true }
);

productSchema.index({ category: 1 });
productSchema.index({ status: 1 });

export type Product = InferSchemaType<typeof productSchema>;
export const ProductModel = model("Product", productSchema);
