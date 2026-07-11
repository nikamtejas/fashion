import { z } from "zod";

export const addCartItemSchema = z.object({
  productId: z.string().min(1),
  variantSku: z.string().min(1).optional(),
  qty: z.coerce.number().int().min(1).default(1),
});

export const updateCartItemSchema = z.object({
  qty: z.coerce.number().int().min(1),
});

export const applyCouponSchema = z.object({
  code: z.string().trim().min(1),
});
