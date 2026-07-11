import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const CategorySchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    description: { type: String },
    image: {
      publicId: { type: String },
      secureUrl: { type: String },
    },
    parent: { type: Schema.Types.ObjectId, ref: "Category" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type CategoryDoc = InferSchemaType<typeof CategorySchema>;

export const Category: Model<CategoryDoc> =
  models.Category ?? model<CategoryDoc>("Category", CategorySchema);
