import type { ClientSession, HydratedDocument } from "mongoose";
import type { Cart } from "../models/Cart.js";
import { ProductModel } from "../models/Product.js";
import { CouponModel } from "../models/Coupon.js";
import { validateCouponForCart } from "../utils/coupon.js";

export interface CartLineResponse {
  itemId: string;
  productId: string;
  productName: string;
  productSlug: string;
  imageUrl: string | null;
  variantSku?: string;
  size?: string;
  color?: string;
  category: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
  availableStock: number;
}

export interface CartResponse {
  items: CartLineResponse[];
  subtotal: number;
  coupon: { code: string; type: "flat" | "percentage"; value: number; discount: number } | null;
  discount: number;
  total: number;
}

// Prices and stock are always looked up live from Product here — the cart never
// snapshots them, so it can't show a stale price. Orphaned lines (deleted product,
// or a variant that no longer exists) are silently pruned and persisted.
//
// Exported so the order-placement transaction (order.service.ts) can reuse the exact
// same line/subtotal computation inside its own session, instead of duplicating it.
export async function computeCartLines(
  cart: HydratedDocument<Cart>,
  session?: ClientSession
): Promise<{ lines: CartLineResponse[]; subtotal: number }> {
  const productIds = [...new Set(cart.items.map((item) => String(item.productId)))];
  const products = await ProductModel.find({ _id: { $in: productIds } }).session(session ?? null);
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const lines: CartLineResponse[] = [];
  const orphanIds: string[] = [];

  for (const item of cart.items) {
    const product = productMap.get(String(item.productId));
    const variant =
      product && item.variantSku ? product.variants.find((v) => v.sku === item.variantSku) : undefined;
    const variantMissing = Boolean(item.variantSku) && !variant;

    if (!product || variantMissing) {
      orphanIds.push(String(item._id));
      continue;
    }

    const primaryImage = product.images.find((img) => img.isPrimary) ?? product.images[0];
    const imageUrl = primaryImage
      ? primaryImage.status === "accepted"
        ? (primaryImage.enhancedUrl ?? primaryImage.originalUrl)
        : primaryImage.originalUrl
      : null;

    const unitPrice = product.pricing.finalPrice;
    lines.push({
      itemId: String(item._id),
      productId: String(product._id),
      productName: product.name,
      productSlug: product.slug,
      imageUrl,
      variantSku: item.variantSku ?? undefined,
      size: variant?.size,
      color: variant?.color,
      category: product.category,
      unitPrice,
      qty: item.qty,
      lineTotal: unitPrice * item.qty,
      availableStock: variant ? variant.stock : product.stock,
    });
  }

  if (orphanIds.length > 0) {
    for (const id of orphanIds) {
      cart.items.id(id)?.deleteOne();
    }
    await cart.save({ session });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  return { lines, subtotal };
}

// Re-validates the cart's stored coupon (if any) against current cart contents on
// every read, dropping it silently if it's no longer valid (expired, deactivated,
// usage limit hit, or minCartValue no longer met after items changed).
export async function buildCartResponse(cart: HydratedDocument<Cart>): Promise<CartResponse> {
  const { lines, subtotal } = await computeCartLines(cart);

  let coupon: CartResponse["coupon"] = null;
  let discount = 0;

  if (cart.couponCode) {
    const couponDoc = await CouponModel.findOne({ code: cart.couponCode });
    const result = couponDoc
      ? validateCouponForCart(
          couponDoc,
          lines.map((line) => ({ category: line.category })),
          subtotal
        )
      : ({ valid: false, reason: "Coupon no longer exists" } as const);

    if (result.valid && couponDoc) {
      coupon = { code: couponDoc.code, type: couponDoc.type, value: couponDoc.value, discount: result.discount };
      discount = result.discount;
    } else {
      cart.couponCode = undefined;
      await cart.save();
    }
  }

  return { items: lines, subtotal, coupon, discount, total: subtotal - discount };
}

export async function applyCouponToCart(
  cart: HydratedDocument<Cart>,
  code: string
): Promise<{ ok: true; response: CartResponse } | { ok: false; reason: string }> {
  const { lines, subtotal } = await computeCartLines(cart);
  const couponDoc = await CouponModel.findOne({ code });
  if (!couponDoc) {
    return { ok: false, reason: "Coupon not found" };
  }

  const result = validateCouponForCart(
    couponDoc,
    lines.map((line) => ({ category: line.category })),
    subtotal
  );
  if (!result.valid) {
    return { ok: false, reason: result.reason };
  }

  cart.couponCode = couponDoc.code;
  await cart.save();

  return {
    ok: true,
    response: {
      items: lines,
      subtotal,
      coupon: { code: couponDoc.code, type: couponDoc.type, value: couponDoc.value, discount: result.discount },
      discount: result.discount,
      total: subtotal - result.discount,
    },
  };
}
