import type { Product } from "../models/Product.js";

type ProductDoc = Product & { _id: unknown };

export function toPublicProduct(product: ProductDoc) {
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
    // sku is included so the storefront can identify a specific variant when adding
    // to cart — it's just an identifier, not sensitive business data like pricing.
    variants: product.variants.map((v) => ({ sku: v.sku, size: v.size, color: v.color, stock: v.stock })),
    images: product.images.map((img) => ({
      url: img.status === "accepted" ? img.enhancedUrl : img.originalUrl,
      isPrimary: img.isPrimary,
      color: img.color,
    })),
  };
}
