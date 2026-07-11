import type { Request, Response } from "express";
import { ProductModel } from "../models/Product.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { toPublicProduct } from "../utils/publicProduct.js";

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
