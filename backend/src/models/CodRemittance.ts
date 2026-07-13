import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * One batch payout from a courier for cash their delivery agents collected
 * on our behalf (Blue Dart/DHL don't hand cash over at the door — they
 * remit it to our bank account in batches, usually weekly, minus their COD
 * handling fee). Logged manually against the courier's remittance report
 * since there's no live API to poll for this.
 */
const CodRemittanceSchema = new Schema(
  {
    courier: { type: String, default: "Blue Dart (DHL)" },
    // Their UTR / remittance report number — how this batch is reconciled
    // against a bank statement later.
    reference: { type: String, required: true, trim: true },
    // Net amount actually credited to our account.
    amount: { type: Number, required: true },
    // COD handling fee the courier deducted before crediting us.
    courierFee: { type: Number, default: 0 },
    remittedAt: { type: Date, required: true },
    payments: { type: [Schema.Types.ObjectId], ref: "Payment", default: [] },
    notes: { type: String },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export type CodRemittanceDoc = InferSchemaType<typeof CodRemittanceSchema>;

export const CodRemittance: Model<CodRemittanceDoc> =
  models.CodRemittance ?? model<CodRemittanceDoc>("CodRemittance", CodRemittanceSchema);
