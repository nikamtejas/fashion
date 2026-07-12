import { Types } from "mongoose";
import { Cart } from "../models/Cart";
import { Product } from "../models/Product";
import { Coupon } from "../models/Coupon";
import { Order } from "../models/Order";
import { cloudinaryUrl } from "../lib/cloudinary";

export const FREE_SHIPPING_THRESHOLD = 2999;
export const SHIPPING_FEE = 99;

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CartLineView {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  sku: string;
  size: string;
  color: string;
  qty: number;
  unitPrice: number;
  unitGst: number;
  unitPreTax: number;
  lineTotal: number;
  stock: number;
  availableSizes: { size: string; sku: string; stock: number }[];
}

export interface CouponRejection {
  code: string;
  reason: string;
}

export interface CartView {
  items: CartLineView[];
  savedItems: { productId: string; slug: string; name: string; image: string | null; sku: string; size: string; color: string; price: number; inStock: boolean }[];
  coupon: { code: string; type: string; value: number; discount: number } | null;
  totals: {
    itemCount: number;
    preTaxSubtotal: number;
    gst: number;
    subtotal: number; // GST-included sum of line totals
    discount: number;
    shipping: number;
    freeShippingThreshold: number;
    amountToFreeShipping: number;
    total: number;
  };
  /** Set when a stored coupon was silently dropped during self-healing. */
  droppedCoupon?: CouponRejection;
}

export async function getOrCreateCart(userId: string) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [], savedItems: [] });
  return cart;
}

interface CouponCheckContext {
  userId: string;
  /** GST-inclusive subtotal of the whole cart. */
  subtotal: number;
  /** GST-inclusive subtotal of only the items eligible under the coupon's restrictions. */
  eligibleSubtotal: (coupon: { applicableCategories: Types.ObjectId[]; applicableProducts: Types.ObjectId[] }) => number;
}

export type CouponDoc = NonNullable<Awaited<ReturnType<typeof Coupon.findOne>>>;

/** Returns the discount amount, or a rejection reason string. */
export async function evaluateCoupon(coupon: CouponDoc, ctx: CouponCheckContext): Promise<{ discount: number } | { reason: string }> {
  if (!coupon.active) return { reason: "This coupon is no longer active" };
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return { reason: "This coupon has expired" };
  if (coupon.usageLimit !== undefined && coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { reason: "This coupon's usage limit has been reached" };
  }
  if (ctx.subtotal < (coupon.minOrderValue ?? 0)) {
    return { reason: `Add items worth ₹${coupon.minOrderValue} to use this coupon` };
  }

  if (coupon.firstOrderOnly) {
    const orderCount = await Order.countDocuments({ user: ctx.userId });
    if (orderCount > 0) return { reason: "This coupon is for first orders only" };
  }
  if (coupon.perUserLimit) {
    const usedByUser = await Order.countDocuments({ user: ctx.userId, coupon: coupon._id });
    if (usedByUser >= coupon.perUserLimit) return { reason: "You've already used this coupon" };
  }

  const restricted = coupon.applicableCategories.length > 0 || coupon.applicableProducts.length > 0;
  const base = restricted
    ? ctx.eligibleSubtotal({
        applicableCategories: coupon.applicableCategories as Types.ObjectId[],
        applicableProducts: coupon.applicableProducts as Types.ObjectId[],
      })
    : ctx.subtotal;
  if (restricted && base <= 0) return { reason: "No items in your bag qualify for this coupon" };

  let discount: number;
  if (coupon.type === "PERCENTAGE") {
    discount = round2((base * coupon.value) / 100);
    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  } else {
    discount = Math.min(coupon.value, base);
  }
  return { discount: round2(discount) };
}

/**
 * Evaluates a coupon against the user's current cart contents, with the
 * real per-item restriction math (categories/products). Used by the apply
 * endpoint and the "available coupons" listing.
 */
export async function evaluateCouponForUser(
  userId: string,
  coupon: CouponDoc
): Promise<{ discount: number } | { reason: string }> {
  const cart = await getOrCreateCart(userId);
  const productIds = [...new Set(cart.items.map((l) => String(l.product)))];
  const products = await Product.find({ _id: { $in: productIds }, status: "PUBLISHED" }).lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  let subtotal = 0;
  const lineTotals: { productId: string; category: string; lineTotal: number }[] = [];
  for (const line of cart.items) {
    const product = productMap.get(String(line.product));
    const variant = product?.variants.find((v) => v.sku === line.sku);
    if (!product || !variant) continue;
    const lineTotal = round2((product.pricing?.finalPrice ?? 0) * line.qty);
    subtotal = round2(subtotal + lineTotal);
    lineTotals.push({ productId: String(product._id), category: String(product.category), lineTotal });
  }

  return evaluateCoupon(coupon, {
    userId,
    subtotal,
    eligibleSubtotal: (r) => {
      const catSet = new Set(r.applicableCategories.map(String));
      const prodSet = new Set(r.applicableProducts.map(String));
      return round2(
        lineTotals.reduce(
          (sum, l) =>
            (prodSet.size > 0 && prodSet.has(l.productId)) || (catSet.size > 0 && catSet.has(l.category))
              ? sum + l.lineTotal
              : sum,
          0
        )
      );
    },
  });
}

/**
 * Builds the live cart view. Self-heals as it goes: orphaned lines
 * (deleted product / vanished SKU) are pruned and persisted, and a stored
 * coupon that has gone invalid is dropped with the reason surfaced once.
 */
export async function buildCartView(userId: string): Promise<CartView> {
  const cart = await getOrCreateCart(userId);

  const productIds = [
    ...new Set([...cart.items, ...cart.savedItems].map((l) => String(l.product))),
  ];
  const products = await Product.find({ _id: { $in: productIds }, status: "PUBLISHED" }).lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const items: CartLineView[] = [];
  const keptLines: typeof cart.items = [] as unknown as typeof cart.items;
  let pruned = false;

  for (const line of cart.items) {
    const product = productMap.get(String(line.product));
    const variant = product?.variants.find((v) => v.sku === line.sku);
    if (!product || !variant) {
      pruned = true;
      continue;
    }
    keptLines.push(line);
    const unitPrice = product.pricing?.finalPrice ?? 0;
    const unitGst = product.pricing?.gstAmount ?? 0;
    items.push({
      productId: String(product._id),
      slug: product.slug,
      name: product.name,
      image: product.images?.[0]?.publicId ? cloudinaryUrl(product.images[0].publicId, 300) : null,
      sku: line.sku,
      size: variant.size,
      color: variant.color,
      qty: line.qty,
      unitPrice,
      unitGst,
      unitPreTax: round2(unitPrice - unitGst),
      lineTotal: round2(unitPrice * line.qty),
      stock: variant.stock,
      availableSizes: product.variants
        .filter((v) => v.color === variant.color)
        .map((v) => ({ size: v.size, sku: v.sku, stock: v.stock })),
    });
  }

  const savedItems: CartView["savedItems"] = [];
  const keptSaved: typeof cart.savedItems = [] as unknown as typeof cart.savedItems;
  for (const line of cart.savedItems) {
    const product = productMap.get(String(line.product));
    const variant = product?.variants.find((v) => v.sku === line.sku);
    if (!product || !variant) {
      pruned = true;
      continue;
    }
    keptSaved.push(line);
    savedItems.push({
      productId: String(product._id),
      slug: product.slug,
      name: product.name,
      image: product.images?.[0]?.publicId ? cloudinaryUrl(product.images[0].publicId, 300) : null,
      sku: line.sku,
      size: variant.size,
      color: variant.color,
      price: product.pricing?.finalPrice ?? 0,
      inStock: variant.stock > 0,
    });
  }

  const subtotal = round2(items.reduce((sum, i) => sum + i.lineTotal, 0));
  const gst = round2(items.reduce((sum, i) => sum + i.unitGst * i.qty, 0));
  const preTaxSubtotal = round2(subtotal - gst);

  const eligibleSubtotal = (r: { applicableCategories: Types.ObjectId[]; applicableProducts: Types.ObjectId[] }) => {
    const catSet = new Set(r.applicableCategories.map(String));
    const prodSet = new Set(r.applicableProducts.map(String));
    return round2(
      items.reduce((sum, i) => {
        const product = productMap.get(i.productId);
        const eligible =
          (prodSet.size > 0 && prodSet.has(i.productId)) ||
          (catSet.size > 0 && product && catSet.has(String(product.category)));
        return eligible ? sum + i.lineTotal : sum;
      }, 0)
    );
  };

  let couponView: CartView["coupon"] = null;
  let droppedCoupon: CouponRejection | undefined;
  let discount = 0;

  if (cart.coupon) {
    const coupon = await Coupon.findById(cart.coupon);
    if (!coupon) {
      cart.coupon = undefined;
    } else {
      const result = await evaluateCoupon(coupon, { userId, subtotal, eligibleSubtotal });
      if ("reason" in result) {
        droppedCoupon = { code: coupon.code, reason: result.reason };
        cart.coupon = undefined;
      } else {
        discount = result.discount;
        couponView = { code: coupon.code, type: coupon.type, value: coupon.value, discount };
      }
    }
  }

  if (pruned || (droppedCoupon && !cart.coupon) || cart.isModified()) {
    cart.items = keptLines;
    cart.savedItems = keptSaved;
    await cart.save();
  }

  const afterDiscount = round2(subtotal - discount);
  const shipping = items.length === 0 || afterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = round2(afterDiscount + shipping);

  return {
    items,
    savedItems,
    coupon: couponView,
    droppedCoupon,
    totals: {
      itemCount: items.reduce((sum, i) => sum + i.qty, 0),
      preTaxSubtotal,
      gst,
      subtotal,
      discount,
      shipping,
      freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
      amountToFreeShipping: Math.max(0, round2(FREE_SHIPPING_THRESHOLD - afterDiscount)),
      total,
    },
  };
}
