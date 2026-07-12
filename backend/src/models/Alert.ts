import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// Price-drop (wishlist) and back-in-stock subscriptions. Fired once, then
// deactivated — re-subscribing re-arms them.
const AlertSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    type: { type: String, enum: ["PRICE_DROP", "BACK_IN_STOCK"], required: true },
    /** Price when the alert was armed — PRICE_DROP fires below this. */
    priceAtSubscribe: { type: Number },
    active: { type: Boolean, default: true, index: true },
    firedAt: { type: Date },
  },
  { timestamps: true }
);

AlertSchema.index({ user: 1, product: 1, type: 1 }, { unique: true });

export type AlertDoc = InferSchemaType<typeof AlertSchema>;

export const Alert: Model<AlertDoc> = models.Alert ?? model<AlertDoc>("Alert", AlertSchema);
