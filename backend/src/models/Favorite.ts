import { Schema, model, type InferSchemaType } from "mongoose";

const favoriteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

favoriteSchema.index({ userId: 1, productId: 1 }, { unique: true });

export type Favorite = InferSchemaType<typeof favoriteSchema>;
export const FavoriteModel = model("Favorite", favoriteSchema);
