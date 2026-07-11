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
    method: { type: String, enum: ["RAZORPAY", "COD", "SNAPMINT"], required: true },
    status: { type: String, enum: ["PENDING", "PAID", "FAILED", "REFUNDED"], default: "PENDING", index: true },
    amount: { type: Number, required: true },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    razorpayMethod: { type: String }, // card/upi/netbanking/... reported after verification
    snapmintPlan: { type: SnapmintPlanSchema },
    codConvenienceFee: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type PaymentDoc = InferSchemaType<typeof PaymentSchema>;

export const Payment: Model<PaymentDoc> =
  models.Payment ?? model<PaymentDoc>("Payment", PaymentSchema);
