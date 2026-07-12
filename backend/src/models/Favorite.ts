import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// Supporting infrastructure for the storefront heart toggle / favorites page
// (not one of the 14 business models in CLAUDE.md, but required for M2's
// "heart-burst favorite toggle" and "favorites page" requirements).
const FavoriteSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
  },
  { timestamps: true }
);

FavoriteSchema.index({ user: 1, product: 1 }, { unique: true });

export type FavoriteDoc = InferSchemaType<typeof FavoriteSchema>;

export const Favorite: Model<FavoriteDoc> = models.Favorite ?? model<FavoriteDoc>("Favorite", FavoriteSchema);
