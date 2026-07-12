import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import { Product } from "../models/Product";
import { checkAlertsForProduct } from "../services/alerts.service";
import { notifyAdmins } from "../services/notify.service";
import { env } from "../config/env";

const router = Router();
router.use(requireAdmin);

router.get("/", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const query: Record<string, unknown> = {};
  if (q) query.name = { $regex: q, $options: "i" };

  const products = await Product.find(query).select("name slug status variants images").sort({ name: 1 }).lean();
  res.json({
    products: products.map((p) => ({
      id: String(p._id),
      name: p.name,
      slug: p.slug,
      status: p.status,
      image: p.images?.[0]?.secureUrl ?? null,
      variants: p.variants.map((v) => ({ sku: v.sku, size: v.size, color: v.color, stock: v.stock })),
      totalStock: p.variants.reduce((s, v) => s + v.stock, 0),
    })),
  });
});

const stockSchema = z.object({ productId: z.string(), sku: z.string(), stock: z.number().int().min(0) });

/** Quick single-SKU stock edit from the inventory grid. */
router.patch("/stock", async (req, res) => {
  const parsed = stockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid stock update" });

  // Read the previous value first so the admin alert can show the delta.
  const product = await Product.findOne({ _id: parsed.data.productId, "variants.sku": parsed.data.sku })
    .select("name variants")
    .lean();
  if (!product) return res.status(404).json({ error: "Product/SKU not found" });
  const variant = product.variants.find((v) => v.sku === parsed.data.sku);

  await Product.updateOne(
    { _id: parsed.data.productId, "variants.sku": parsed.data.sku },
    { $set: { "variants.$[v].stock": parsed.data.stock } },
    { arrayFilters: [{ "v.sku": parsed.data.sku }] }
  );
  checkAlertsForProduct(parsed.data.productId).catch((e) => console.error("alert check failed:", e));
  res.json({ ok: true });

  // Admin audit email after responding — mail issues never fail the edit.
  const oldStock = variant?.stock ?? 0;
  if (oldStock !== parsed.data.stock) {
    notifyAdmins(
      `Stock updated: ${product.name} (${parsed.data.sku})`,
      [
        `${product.name} — ${[variant?.size, variant?.color].filter(Boolean).join(" / ")} (${parsed.data.sku})`,
        `Stock: ${oldStock} → ${parsed.data.stock}`,
        ...(parsed.data.stock < 5 ? ["", "Heads-up: this SKU is now low on stock (< 5 units)."] : []),
        "",
        `Inventory: ${env.frontendUrl}/admin/inventory`,
      ].join("\n"),
      { heading: "Inventory change" }
    ).catch((e) => console.error("stock email failed:", e));
  }
});

export default router;
