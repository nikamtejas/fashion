import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const SnapmintPlanSchema = new Schema(
  {
    tenureMonths: { type: Number },
    monthlyAmount: { type: Number },
    downPayment: { type: Number },
    snapmintOrderId: { type: String },
  },
  { _id: false }
);

const PaymentSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    method: { type: String, enum: ["RAZORPAY", "COD", "SNAPMINT", "CASH", "CARD", "UPI"], required: true },
    // REFUND_PENDING = a cancellation refund is due but the payment method
    // has no refund API (COD/CASH/CARD/UPI) — awaiting the customer's bank
    // details, then an admin payout, before it becomes REFUNDED.
    status: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED", "REFUND_PENDING"],
      default: "PENDING",
      index: true,
    },
    amount: { type: Number, required: true },
    refundBankDetails: {
      accountName: { type: String },
      accountNumber: { type: String },
      ifsc: { type: String },
    },
    refundedAt: { type: Date },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    razorpayMethod: { type: String }, // card/upi/netbanking/... reported after verification
    snapmintPlan: { type: SnapmintPlanSchema },
    codConvenienceFee: { type: Number, default: 0 },
    // Only set for HOME-delivery COD paid in cash: the courier collects cash
    // at the door but remits it to our bank account in batches later, so
    // "PAID" (customer settled) and "REMITTED" (money is actually ours) are
    // different moments. Store-pickup COD skips this — that cash lands in
    // the till directly, nothing to remit.
    codRemittanceStatus: { type: String, enum: ["PENDING", "REMITTED"] },
    codCollectedAt: { type: Date },
    codRemittance: { type: Schema.Types.ObjectId, ref: "CodRemittance" },
  },
  { timestamps: true }
);

export type PaymentDoc = InferSchemaType<typeof PaymentSchema>;

export const Payment: Model<PaymentDoc> =
  models.Payment ?? model<PaymentDoc>("Payment", PaymentSchema);
