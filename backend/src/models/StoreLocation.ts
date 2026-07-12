import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const HoursSchema = new Schema(
  {
    day: { type: String, enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"], required: true },
    open: { type: String, required: true }, // "10:00"
    close: { type: String, required: true }, // "20:00"
  },
  { _id: false }
);

const PickupWindowSchema = new Schema(
  {
    start: { type: String, required: true }, // "10:00"
    end: { type: String, required: true }, // "12:00"
  },
  { _id: false }
);

export const DEFAULT_PICKUP_CONFIG = {
  windows: [
    { start: "10:00", end: "12:00" },
    { start: "12:00", end: "14:00" },
    { start: "14:00", end: "16:00" },
    { start: "16:00", end: "18:00" },
    { start: "18:00", end: "20:00" },
  ],
  capacityPerSlot: 4,
  sameDayReadyHours: 3,
};

const StoreLocationSchema = new Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true, index: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    phone: { type: String },
    hours: { type: [HoursSchema], default: [] },
    pickupConfig: {
      windows: { type: [PickupWindowSchema], default: () => DEFAULT_PICKUP_CONFIG.windows },
      capacityPerSlot: { type: Number, default: DEFAULT_PICKUP_CONFIG.capacityPerSlot },
      sameDayReadyHours: { type: Number, default: DEFAULT_PICKUP_CONFIG.sameDayReadyHours },
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

StoreLocationSchema.index({ lat: 1, lng: 1 });

export type StoreLocationDoc = InferSchemaType<typeof StoreLocationSchema>;

export const StoreLocation: Model<StoreLocationDoc> =
  models.StoreLocation ?? model<StoreLocationDoc>("StoreLocation", StoreLocationSchema);
