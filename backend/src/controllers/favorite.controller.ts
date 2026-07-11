import type { Request, Response } from "express";
import { FavoriteModel } from "../models/Favorite.js";
import { ProductModel } from "../models/Product.js";
import { addFavoriteSchema } from "../validators/favorite.validators.js";
import { toPublicProduct } from "../utils/publicProduct.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

export const listFavorites = asyncHandler(async (req: Request, res: Response) => {
  const favorites = await FavoriteModel.find({ userId: req.session!.sub }).sort({ createdAt: -1 });
  const productIds = favorites.map((f) => f.productId);
  const products = await ProductModel.find({ _id: { $in: productIds }, status: "published" });
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  // Preserve favorited-order and silently drop products that were deleted/unpublished
  // since being favorited, rather than erroring the whole list.
  const items = favorites
    .map((f) => productMap.get(String(f.productId)))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map(toPublicProduct);

  res.json({ items });
});

// Idempotent by design — the storefront just toggles the heart icon and doesn't
// need to track whether this was already favorited.
export const addFavorite = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = addFavoriteSchema.parse(req.body);
  const product = await ProductModel.findOne({ _id: productId, status: "published" });
  if (!product) throw new ApiError(404, "Product not found");

  await FavoriteModel.findOneAndUpdate(
    { userId: req.session!.sub, productId },
    { userId: req.session!.sub, productId },
    { upsert: true }
  );

  res.status(201).json({ favorited: true });
});

export const removeFavorite = asyncHandler(async (req: Request, res: Response) => {
  await FavoriteModel.deleteOne({ userId: req.session!.sub, productId: req.params.productId });
  res.status(204).send();
});
