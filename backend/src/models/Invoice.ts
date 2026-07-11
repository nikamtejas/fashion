import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const InvoiceLineSchema = new Schema(
  {
    name: { type: String, required: true },
    hsnCode: { type: String },
    qty: { type: Number, required: true },
    price: { type: Number, required: true },
    gstRate: { type: Number, required: true },
  },
  { _id: false }
);

const InvoiceSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    lines: { type: [InvoiceLineSchema], default: [] },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    total: { type: Number, required: true },
    amountInWords: { type: String },
    pdfUrl: { type: String },
    isPos: { type: Boolean, default: false }, // walk-in POS sale vs. online order
  },
  { timestamps: true }
);

export type InvoiceDoc = InferSchemaType<typeof InvoiceSchema>;

export const Invoice: Model<InvoiceDoc> =
  models.Invoice ?? model<InvoiceDoc>("Invoice", InvoiceSchema);
