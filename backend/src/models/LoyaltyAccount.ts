import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const LoyaltyHistorySchema = new Schema(
  {
    type: { type: String, enum: ["EARN", "REDEEM"], required: true },
    points: { type: Number, required: true },
    order: { type: Schema.Types.ObjectId, ref: "Order" },
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

const LoyaltyAccountSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    points: { type: Number, default: 0 },
    history: { type: [LoyaltyHistorySchema], default: [] },
  },
  { timestamps: true }
);

export type LoyaltyAccountDoc = InferSchemaType<typeof LoyaltyAccountSchema>;

export const LoyaltyAccount: Model<LoyaltyAccountDoc> =
  models.LoyaltyAccount ?? model<LoyaltyAccountDoc>("LoyaltyAccount", LoyaltyAccountSchema);
