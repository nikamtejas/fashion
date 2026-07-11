import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// Supporting infrastructure for NextAuth email-OTP login (not one of the
// 14 business models in CLAUDE.md, but required to implement it).
const OtpTokenSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date },
  },
  { timestamps: true }
);

OtpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type OtpTokenDoc = InferSchemaType<typeof OtpTokenSchema>;

export const OtpToken: Model<OtpTokenDoc> =
  models.OtpToken ?? model<OtpTokenDoc>("OtpToken", OtpTokenSchema);
