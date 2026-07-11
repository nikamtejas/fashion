import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const ReviewSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String },
    body: { type: String },
    photos: { type: [{ publicId: String, secureUrl: String }], default: [] },
    verifiedPurchase: { type: Boolean, default: false },
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING", index: true },
  },
  { timestamps: true }
);

ReviewSchema.index({ product: 1, status: 1 });

export type ReviewDoc = InferSchemaType<typeof ReviewSchema>;

export const Review: Model<ReviewDoc> = models.Review ?? model<ReviewDoc>("Review", ReviewSchema);
