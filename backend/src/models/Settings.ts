import { Schema, model, type InferSchemaType } from "mongoose";

// Singleton document (there is exactly one). Seeded with the long-standing Indian
// apparel/footwear GST slab (5% under ₹1000, 12% at/above) as a starting default —
// NOT a hardcoded business rule. Admin must verify against current GST portal
// guidance before launch and can change these at any time from the settings page.
const settingsSchema = new Schema(
  {
    gstThreshold: { type: Number, required: true, min: 0, default: 1000 },
    gstRateLow: { type: Number, required: true, min: 0, max: 100, default: 5 },
    gstRateHigh: { type: Number, required: true, min: 0, max: 100, default: 12 },
  },
  { timestamps: true }
);

export type Settings = InferSchemaType<typeof settingsSchema>;
export const SettingsModel = model("Settings", settingsSchema);

export async function getSettings() {
  const existing = await SettingsModel.findOne();
  if (existing) return existing;
  return SettingsModel.create({});
}
