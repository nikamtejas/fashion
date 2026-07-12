import { Alert } from "../models/Alert";
import { Product } from "../models/Product";
import { notifyUser } from "./notify.service";

/**
 * Fires any armed alerts a product change satisfies. Called after admin
 * pricing/stock writes — cheap (indexed on product+active) and idempotent
 * since fired alerts deactivate.
 */
export async function checkAlertsForProduct(productId: string) {
  const product = await Product.findById(productId).select("name slug pricing.finalPrice variants status").lean();
  if (!product || product.status !== "PUBLISHED") return;

  const alerts = await Alert.find({ product: productId, active: true });
  if (alerts.length === 0) return;

  const price = product.pricing?.finalPrice ?? 0;
  const inStock = product.variants.some((v) => v.stock > 0);

  for (const alert of alerts) {
    if (alert.type === "PRICE_DROP" && alert.priceAtSubscribe && price > 0 && price < alert.priceAtSubscribe) {
      alert.active = false;
      alert.firedAt = new Date();
      await alert.save();
      await notifyUser(
        String(alert.user),
        `Price drop: ${product.name}`,
        `Now ₹${price.toLocaleString("en-IN")} — was ₹${alert.priceAtSubscribe.toLocaleString("en-IN")} when you set the alert.`,
        `/products/${product.slug}`
      );
    } else if (alert.type === "BACK_IN_STOCK" && inStock) {
      alert.active = false;
      alert.firedAt = new Date();
      await alert.save();
      await notifyUser(
        String(alert.user),
        `Back in stock: ${product.name}`,
        "It's available again — sizes tend to go fast.",
        `/products/${product.slug}`
      );
    }
  }
}
