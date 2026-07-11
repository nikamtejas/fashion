import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const HoursSchema = new Schema(
  {
    day: { type: String, enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"], required: true },
    open: { type: String, required: true }, // "10:00"
    close: { type: String, required: true }, // "20:00"
  },
  { _id: false }
);

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
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

StoreLocationSchema.index({ lat: 1, lng: 1 });

export type StoreLocationDoc = InferSchemaType<typeof StoreLocationSchema>;

export const StoreLocation: Model<StoreLocationDoc> =
  models.StoreLocation ?? model<StoreLocationDoc>("StoreLocation", StoreLocationSchema);
