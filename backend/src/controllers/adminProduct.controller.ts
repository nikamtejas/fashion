import type { Request, Response } from "express";
import { ProductModel } from "../models/Product.js";
import { createProductSchema, updateProductSchema } from "../validators/product.validators.js";
import { slugify } from "../utils/slug.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { destroyImage } from "../services/cloudinary.service.js";
import { revalidateStorefront } from "../services/revalidate.service.js";

async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name) || "product";
  let slug = base;
  let suffix = 2;
  while (await ProductModel.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    slug = `${base}-${suffix++}`;
  }
  return slug;
}

function assertPublishable(product: { status: string; images: unknown[] }) {
  if (product.status === "published" && product.images.length === 0) {
    throw new ApiError(400, "Published products need at least one image");
  }
}

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const filter: Record<string, unknown> = {};
  if (typeof req.query.status === "string") filter.status = req.query.status;
  if (typeof req.query.category === "string") filter.category = req.query.category;

  const [items, total] = await Promise.all([
    ProductModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    ProductModel.countDocuments(filter),
  ]);

  res.json({ items, total, page, pageSize });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await ProductModel.findById(req.params.id);
  if (!product) throw new ApiError(404, "Product not found");
  res.json({ product });
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const input = createProductSchema.parse(req.body);
  assertPublishable(input);
  const slug = await uniqueSlug(input.name);
  const product = await ProductModel.create({ ...input, slug });
  await revalidateStorefront(product.slug);
  res.status(201).json({ product });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const input = updateProductSchema.parse(req.body);
  const product = await ProductModel.findById(req.params.id);
  if (!product) throw new ApiError(404, "Product not found");

  Object.assign(product, input);
  if (input.name && input.name !== product.name) {
    product.slug = await uniqueSlug(input.name, String(product._id));
  }
  assertPublishable(product);
  await product.save();
  await revalidateStorefront(product.slug);
  res.json({ product });
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await ProductModel.findByIdAndDelete(req.params.id);
  if (!product) throw new ApiError(404, "Product not found");

  await Promise.allSettled(
    product.images.flatMap((img) => [
      destroyImage(img.originalPublicId),
      ...(img.enhancedPublicId ? [destroyImage(img.enhancedPublicId)] : []),
    ])
  );

  await revalidateStorefront(product.slug);
  res.status(204).send();
});
