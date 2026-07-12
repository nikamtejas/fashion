import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const RefundItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sku: { type: String, required: true },
    qty: { type: Number, required: true },
  },
  { _id: false }
);

const RefundRequestSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    items: { type: [RefundItemSchema], default: [] },
    reason: { type: String, required: true },
    photos: { type: [{ publicId: String, secureUrl: String }], default: [] },
    method: { type: String, enum: ["COURIER", "STORE"] },
    status: {
      type: String,
      enum: [
        "REQUESTED",
        "APPROVED",
        "REJECTED",
        "ITEM_PICKED_UP",
        "DROPPED_AT_STORE",
        "RECEIVED",
        "REFUNDED",
      ],
      default: "REQUESTED",
      index: true,
    },
    refundAmount: { type: Number },
    storeLocation: { type: Schema.Types.ObjectId, ref: "StoreLocation" },
    appointment: { type: Schema.Types.ObjectId, ref: "PickupAppointment" },
    /** Reverse-pickup shipment when method is COURIER. */
    reverseShipment: { type: Schema.Types.ObjectId, ref: "Shipment" },
    /** COD orders refund via manual bank payout — details supplied by the customer. */
    bankDetails: {
      accountName: { type: String },
      accountNumber: { type: String },
      ifsc: { type: String },
    },
    expectedCreditDate: { type: Date },
    rejectionReason: { type: String },
    qcNotes: { type: String },
  },
  { timestamps: true }
);

export type RefundRequestDoc = InferSchemaType<typeof RefundRequestSchema>;

export const RefundRequest: Model<RefundRequestDoc> =
  models.RefundRequest ?? model<RefundRequestDoc>("RefundRequest", RefundRequestSchema);
