import { z } from "zod";

const shippingAddressSchema = z.object({
  line1: z.string().trim().min(1),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  pincode: z.string().trim().min(1),
});

export const placeOrderSchema = z.object({
  shippingAddress: shippingAddressSchema,
  whatsappNumber: z.string().trim().min(6).max(20),
});

export const verifyRazorpaySchema = placeOrderSchema.extend({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});
