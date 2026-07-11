import { z } from "zod";

const variantSchema = z.object({
  size: z.string().trim().min(1),
  color: z.string().trim().min(1),
  sku: z.string().trim().min(1),
  stock: z.coerce.number().int().min(0),
});

const productImageSchema = z.object({
  originalPublicId: z.string().min(1),
  originalUrl: z.string().url(),
  enhancedPublicId: z.string().min(1).optional(),
  enhancedUrl: z.string().url().optional(),
  geminiModel: z.string().optional(),
  status: z.enum(["accepted", "original"]),
  isPrimary: z.boolean().default(false),
});

// Only the raw inputs are accepted from the client — baseCost/marginAmount/preTaxPrice/
// gstRate/gstAmount/finalPrice are always recomputed server-side (see computePricing),
// never trusted from the request body.
const pricingInputSchema = z.object({
  purchasePrice: z.coerce.number().min(0),
  fixedCost: z.coerce.number().min(0),
  marginPct: z.coerce.number().min(0),
  gstThreshold: z.coerce.number().min(0),
  gstRateLow: z.coerce.number().min(0).max(100),
  gstRateHigh: z.coerce.number().min(0).max(100),
});

const productBaseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  category: z.string().trim().min(1).max(100),
  tags: z.array(z.string().trim().min(1)).default([]),
  stock: z.coerce.number().int().min(0).default(0),
  variants: z.array(variantSchema).default([]),
  pricing: pricingInputSchema,
  images: z.array(productImageSchema).default([]),
  status: z.enum(["draft", "published"]).default("draft"),
});

export const createProductSchema = productBaseSchema;
export const updateProductSchema = productBaseSchema.partial();

export const enhanceImageBodySchema = z.object({
  tier: z.enum(["primary", "fast"]).default("fast"),
  promptOverride: z.string().trim().max(2000).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
