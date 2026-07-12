import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// In-app notifications (order status changes, refund updates, pickup
// reminders). Emails go out alongside these via lib/mailer.
const NotificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    body: { type: String },
    link: { type: String }, // in-app destination, e.g. /track/<orderId>
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ user: 1, createdAt: -1 });

export type NotificationDoc = InferSchemaType<typeof NotificationSchema>;

export const Notification: Model<NotificationDoc> =
  models.Notification ?? model<NotificationDoc>("Notification", NotificationSchema);
