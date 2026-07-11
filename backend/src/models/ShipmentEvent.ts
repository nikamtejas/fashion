import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const ShipmentEventSchema = new Schema(
  {
    shipment: { type: Schema.Types.ObjectId, ref: "Shipment", required: true, index: true },
    status: { type: String, required: true },
    location: { type: String },
    description: { type: String },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
  },
  { timestamps: true }
);

export type ShipmentEventDoc = InferSchemaType<typeof ShipmentEventSchema>;

export const ShipmentEvent: Model<ShipmentEventDoc> =
  models.ShipmentEvent ?? model<ShipmentEventDoc>("ShipmentEvent", ShipmentEventSchema);
