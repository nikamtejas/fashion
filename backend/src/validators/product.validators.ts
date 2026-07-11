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

const productBaseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  category: z.string().trim().min(1).max(100),
  tags: z.array(z.string().trim().min(1)).default([]),
  stock: z.coerce.number().int().min(0).default(0),
  variants: z.array(variantSchema).default([]),
  price: z.coerce.number().min(0),
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
