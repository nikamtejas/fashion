import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const ShipmentSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    courier: { type: String, enum: ["BLUEDART"], default: "BLUEDART" },
    awbNumber: { type: String, index: true },
    status: {
      type: String,
      enum: [
        "PENDING",
        "PICKUP_SCHEDULED",
        "PICKED_UP",
        "IN_TRANSIT",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "RTO",
      ],
      default: "PENDING",
      index: true,
    },
    labelUrl: { type: String },
    pickupScheduledAt: { type: Date },
    estimatedDelivery: { type: Date },
    currentLocation: {
      lat: { type: Number },
      lng: { type: Number },
      label: { type: String },
      scannedAt: { type: Date },
    },
    proofOfDeliveryUrl: { type: String },
  },
  { timestamps: true }
);

export type ShipmentDoc = InferSchemaType<typeof ShipmentSchema>;

export const Shipment: Model<ShipmentDoc> =
  models.Shipment ?? model<ShipmentDoc>("Shipment", ShipmentSchema);
