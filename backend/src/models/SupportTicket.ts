import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const SupportMessageSchema = new Schema(
  {
    sender: { type: String, enum: ["CUSTOMER", "SUPPORT"], required: true },
    body: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const SupportTicketSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, required: true },
    category: {
      type: String,
      enum: ["ORDER", "REFUND", "PAYMENT", "PRODUCT", "OTHER"],
      default: "OTHER",
      index: true,
    },
    /** Optional link to the order the question is about. */
    order: { type: Schema.Types.ObjectId, ref: "Order" },
    status: { type: String, enum: ["OPEN", "RESOLVED"], default: "OPEN", index: true },
    messages: { type: [SupportMessageSchema], default: [] },
    /** Set when the customer hasn't seen the latest support reply yet. */
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export type SupportTicketDoc = InferSchemaType<typeof SupportTicketSchema>;

export const SupportTicket: Model<SupportTicketDoc> =
  models.SupportTicket ?? model<SupportTicketDoc>("SupportTicket", SupportTicketSchema);
