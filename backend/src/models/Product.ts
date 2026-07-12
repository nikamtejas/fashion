import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const VariantSchema = new Schema(
  {
    size: { type: String, required: true },
    color: { type: String, required: true },
    colorHex: { type: String },
    sku: { type: String, required: true },
    stock: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const ProductImageSchema = new Schema(
  {
    publicId: { type: String, required: true },
    secureUrl: { type: String, required: true },
    type: { type: String, enum: ["ORIGINAL", "STUDIO", "AI_MODEL"], required: true },
    side: { type: String, enum: ["FRONT", "BACK"] }, // which garment side this photo shows (ORIGINAL/STUDIO pairs)
    slot: { type: String, enum: ["MODEL_FRONT", "LIFESTYLE"] }, // which AI_MODEL photo this is (photo 3 vs photo 4)
    color: { type: String }, // ties image to a variant color; untagged = shown for all colors
    altText: { type: String },
    order: { type: Number, default: 0 },
    isCover: { type: Boolean, default: false }, // admin-chosen storefront poster; at most one per product
    faithfulnessFlag: { type: Boolean, default: false }, // set by M2 vision faithfulness check
  },
  { _id: true }
);

// Full pricing breakdown — always written by computePricing() in
// lib/pricing.ts (M3), never assembled by hand or trusted from a client.
const PricingSchema = new Schema(
  {
    purchasePrice: { type: Number, default: 0 },
    marginType: { type: String, enum: ["PERCENTAGE", "FLAT"], default: "PERCENTAGE" },
    marginValue: { type: Number, default: 0 },
    marginAmount: { type: Number, default: 0 }, // margin in rupees
    fixedCosts: {
      type: [{ name: String, value: Number }],
      default: [],
    },
    fixedCostsTotal: { type: Number, default: 0 },
    customParams: {
      type: [{ name: String, value: Number }],
      default: [],
    },
    customParamsTotal: { type: Number, default: 0 },
    baseCost: { type: Number, default: 0 }, // purchasePrice + margin + fixedCosts + customParams
    suggestedGstRate: { type: Number, default: 5 }, // slab the ₹1,000 rule suggested
    gstInclusive: { type: Boolean, default: false },
    gstRate: { type: Number, default: 5 }, // slab actually applied (override or suggested)
    gstAmount: { type: Number, default: 0 },
    taxType: { type: String, enum: ["CGST_SGST", "IGST"], default: "CGST_SGST" },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    preTaxPrice: { type: Number, default: 0 },
    mrp: { type: Number }, // optional compare-at price for strike-through
    discountPct: { type: Number }, // whole-percent badge when mrp > finalPrice
    finalPrice: { type: Number, default: 0 },
    marginPct: { type: Number, default: 0 }, // effective margin %, derived
    profitPerUnit: { type: Number, default: 0 },
  },
  { _id: false }
);

const ProductSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    description: { type: String, default: "" },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    gender: { type: String, enum: ["MEN", "WOMEN", "UNISEX"], default: "UNISEX" },
    brand: { type: String, default: "LuxeLoom" },
    tags: { type: [String], default: [] },
    variants: { type: [VariantSchema], default: [] },
    images: { type: [ProductImageSchema], default: [] },
    pricing: { type: PricingSchema, default: () => ({}) },
    status: { type: String, enum: ["DRAFT", "PUBLISHED"], default: "DRAFT", index: true },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ProductSchema.index({ name: "text", description: "text", tags: "text" });
ProductSchema.index({ category: 1, status: 1 });

export type ProductDoc = InferSchemaType<typeof ProductSchema>;

export const Product: Model<ProductDoc> =
  models.Product ?? model<ProductDoc>("Product", ProductSchema);
