import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// Singleton store-wide settings, admin-editable so thresholds never require
// a redeploy. Read through getSettings() which lazily creates the doc.
const SettingsSchema = new Schema(
  {
    singleton: { type: String, default: "SETTINGS", unique: true },
    /** Snapmint EMI shows only when the payable amount meets this. */
    emiMinimumOrderValue: { type: Number, default: 3000 },
    /** COD refused above this order value. */
    codMaxOrderValue: { type: Number, default: 10000 },
    /** Optional COD convenience fee added as its own line. 0 disables it. */
    codConvenienceFee: { type: Number, default: 49 },
    /** Days after delivery during which returns are accepted. */
    returnWindowDays: { type: Number, default: 14 },
  },
  { timestamps: true }
);

export type SettingsDoc = InferSchemaType<typeof SettingsSchema>;

export const Settings: Model<SettingsDoc> =
  models.Settings ?? model<SettingsDoc>("Settings", SettingsSchema);

export async function getSettings() {
  let doc = await Settings.findOne({ singleton: "SETTINGS" });
  if (!doc) doc = await Settings.create({ singleton: "SETTINGS" });
  return doc;
}
