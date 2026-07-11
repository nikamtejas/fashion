import { z } from "zod";

export const updateSettingsSchema = z.object({
  gstThreshold: z.coerce.number().min(0),
  gstRateLow: z.coerce.number().min(0).max(100),
  gstRateHigh: z.coerce.number().min(0).max(100),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
