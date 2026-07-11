import { z } from "zod";

const couponBaseSchema = z.object({
  code: z.string().trim().min(1).max(40),
  type: z.enum(["flat", "percentage"]),
  value: z.coerce.number().min(0),
  maxDiscount: z.coerce.number().min(0).optional(),
  minCartValue: z.coerce.number().min(0).default(0),
  expiresAt: z.coerce.date().optional(),
  usageLimit: z.coerce.number().int().min(0).optional(),
  applicableCategories: z.array(z.string().trim().min(1)).default([]),
  active: z.boolean().default(true),
});

export const createCouponSchema = couponBaseSchema;
export const updateCouponSchema = couponBaseSchema.partial();

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
