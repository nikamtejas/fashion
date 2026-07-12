import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// Shop-the-look: an admin-composed outfit customers add to the bag in one tap.
const LookbookSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    products: { type: [Schema.Types.ObjectId], ref: "Product", default: [] },
    coverImage: {
      publicId: { type: String },
      secureUrl: { type: String },
    },
    active: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type LookbookDoc = InferSchemaType<typeof LookbookSchema>;

export const Lookbook: Model<LookbookDoc> = models.Lookbook ?? model<LookbookDoc>("Lookbook", LookbookSchema);
