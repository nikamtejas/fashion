import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const AddressSchema = new Schema(
  {
    label: { type: String, default: "Home" },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true, index: true },
    country: { type: String, default: "India" },
    lat: { type: Number },
    lng: { type: Number },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const UserSchema = new Schema(
  {
    name: { type: String },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    emailVerified: { type: Date },
    image: { type: String },
    phone: { type: String },
    phoneVerified: { type: Date },
    dob: { type: Date },
    // OPS: day-to-day operations (orders, returns, pickups, support, POS,
    // inventory, dashboard) — everything short of settings/coupons/finance.
    // CATALOG: product/content management (products, photo studio,
    // lookbooks) — no order or customer data access.
    // ADMIN is the superuser and can do everything both can, plus the
    // sensitive routes (settings, coupons, newsletter, invoices).
    role: { type: String, enum: ["CUSTOMER", "ADMIN", "OPS", "CATALOG"], default: "CUSTOMER", index: true },
    addresses: { type: [AddressSchema], default: [] },
    googleId: { type: String },
    // Optional — accounts created before this feature (or via Google OAuth)
    // have none until they set one via "Forgot password". select: false so
    // it never rides along on routine .find()/.findById() reads; routes that
    // actually need to compare it ask with .select("+passwordHash").
    passwordHash: { type: String, select: false },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof UserSchema>;

export const User: Model<UserDoc> = models.User ?? model<UserDoc>("User", UserSchema);
