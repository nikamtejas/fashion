import type { Request, Response } from "express";
import { ProductModel, type Product } from "../models/Product.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

type ProductDoc = Product & { _id: unknown };

function toPublicProduct(product: ProductDoc) {
  return {
    id: String(product._id),
    name: product.name,
    slug: product.slug,
    description: product.description,
    category: product.category,
    tags: product.tags,
    // Only the customer-facing final price is ever exposed here — the cost/margin/GST
    // breakdown in pricing{} is internal business data and must never leak publicly.
    price: product.pricing.finalPrice,
    stock: product.stock,
    variants: product.variants.map((v) => ({ size: v.size, color: v.color, stock: v.stock })),
    images: product.images.map((img) => ({
      url: img.status === "accepted" ? img.enhancedUrl : img.originalUrl,
      isPrimary: img.isPrimary,
    })),
  };
}

export const listPublicProducts = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const filter: Record<string, unknown> = { status: "published" };
  if (typeof req.query.category === "string") filter.category = req.query.category;

  const [items, total] = await Promise.all([
    ProductModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    ProductModel.countDocuments(filter),
  ]);

  res.json({ items: items.map(toPublicProduct), total, page, pageSize });
});

export const getPublicProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await ProductModel.findOne({ slug: req.params.slug, status: "published" });
  if (!product) throw new ApiError(404, "Product not found");
  res.json({ product: toPublicProduct(product) });
});
