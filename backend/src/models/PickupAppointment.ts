import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const PickupAppointmentSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    /** PICKUP = collecting a purchase (M4); RETURN = dropping off a return (M6). */
    type: { type: String, enum: ["PICKUP", "RETURN"], default: "PICKUP", index: true },
    storeLocation: { type: Schema.Types.ObjectId, ref: "StoreLocation", required: true, index: true },
    date: { type: Date, required: true, index: true },
    timeSlot: { type: String, required: true }, // e.g. "14:00-15:00"
    status: {
      type: String,
      enum: ["BOOKED", "READY", "COMPLETED", "CANCELLED", "NO_SHOW"],
      default: "BOOKED",
      index: true,
    },
    qrCode: { type: String },
    remindersSent: { type: [String], default: [] }, // "24H", "2H"
  },
  { timestamps: true }
);

export type PickupAppointmentDoc = InferSchemaType<typeof PickupAppointmentSchema>;

export const PickupAppointment: Model<PickupAppointmentDoc> =
  models.PickupAppointment ??
  model<PickupAppointmentDoc>("PickupAppointment", PickupAppointmentSchema);
