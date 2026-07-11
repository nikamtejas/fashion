import type { Request, Response } from "express";
import { getOrCreateCart } from "../models/Cart.js";
import { ProductModel } from "../models/Product.js";
import { buildCartResponse, applyCouponToCart } from "../services/cart.service.js";
import { addCartItemSchema, updateCartItemSchema, applyCouponSchema } from "../validators/cart.validators.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

export const getCart = asyncHandler(async (req: Request, res: Response) => {
  const cart = await getOrCreateCart(req.session!.sub);
  res.json(await buildCartResponse(cart));
});

export const addCartItem = asyncHandler(async (req: Request, res: Response) => {
  const input = addCartItemSchema.parse(req.body);
  const product = await ProductModel.findOne({ _id: input.productId, status: "published" });
  if (!product) throw new ApiError(404, "Product not found");

  let availableStock = product.stock;
  if (input.variantSku) {
    const variant = product.variants.find((v) => v.sku === input.variantSku);
    if (!variant) throw new ApiError(400, "Variant not found");
    availableStock = variant.stock;
  } else if (product.variants.length > 0) {
    throw new ApiError(400, "Please select a size/variant");
  }

  const cart = await getOrCreateCart(req.session!.sub);
  const existing = cart.items.find(
    (item) => String(item.productId) === input.productId && item.variantSku === input.variantSku
  );
  const requestedTotal = (existing?.qty ?? 0) + input.qty;
  if (requestedTotal > availableStock) {
    throw new ApiError(400, `Only ${availableStock} in stock`);
  }

  if (existing) {
    existing.qty = requestedTotal;
  } else {
    cart.items.push({ productId: input.productId, variantSku: input.variantSku, qty: input.qty });
  }
  await cart.save();

  res.status(201).json(await buildCartResponse(cart));
});

export const updateCartItem = asyncHandler(async (req: Request, res: Response) => {
  const input = updateCartItemSchema.parse(req.body);
  const cart = await getOrCreateCart(req.session!.sub);
  const item = cart.items.id(req.params.itemId);
  if (!item) throw new ApiError(404, "Cart item not found");

  const product = await ProductModel.findById(item.productId);
  if (!product) throw new ApiError(404, "Product no longer available");
  const variant = item.variantSku ? product.variants.find((v) => v.sku === item.variantSku) : undefined;
  const availableStock = variant ? variant.stock : product.stock;
  if (input.qty > availableStock) {
    throw new ApiError(400, `Only ${availableStock} in stock`);
  }

  item.qty = input.qty;
  await cart.save();
  res.json(await buildCartResponse(cart));
});

export const removeCartItem = asyncHandler(async (req: Request, res: Response) => {
  const cart = await getOrCreateCart(req.session!.sub);
  const item = cart.items.id(req.params.itemId);
  if (!item) throw new ApiError(404, "Cart item not found");
  item.deleteOne();
  await cart.save();
  res.json(await buildCartResponse(cart));
});

export const applyCoupon = asyncHandler(async (req: Request, res: Response) => {
  const input = applyCouponSchema.parse(req.body);
  const cart = await getOrCreateCart(req.session!.sub);
  const result = await applyCouponToCart(cart, input.code.trim().toUpperCase());
  if (!result.ok) {
    throw new ApiError(400, result.reason);
  }
  res.json(result.response);
});

export const removeCoupon = asyncHandler(async (req: Request, res: Response) => {
  const cart = await getOrCreateCart(req.session!.sub);
  cart.couponCode = undefined;
  await cart.save();
  res.json(await buildCartResponse(cart));
});
