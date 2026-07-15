import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { Product } from "../models/Product";
import { Coupon } from "../models/Coupon";
import { getOrCreateCart, buildCartView, evaluateCouponForUser, evaluateCouponsForUser } from "../services/cart.service";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  res.json({ cart: await buildCartView(req.user!.uid) });
});

const addSchema = z.object({
  productId: z.string(),
  sku: z.string(),
  qty: z.number().int().min(1).default(1),
});

router.post("/items", async (req, res) => {
  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  const { productId, sku, qty } = parsed.data;

  const product = await Product.findOne({ _id: productId, status: "PUBLISHED" }).lean();
  const variant = product?.variants.find((v) => v.sku === sku);
  if (!product || !variant) return res.status(404).json({ error: "Product or size not found" });

  const cart = await getOrCreateCart(req.user!.uid);
  const existing = cart.items.find((l) => l.sku === sku);
  const newQty = (existing?.qty ?? 0) + qty;
  if (newQty > variant.stock) {
    return res.status(400).json({ error: `Only ${variant.stock} in stock` });
  }

  if (existing) {
    existing.qty = newQty;
  } else {
    cart.items.push({ product: product._id, sku, qty } as (typeof cart.items)[number]);
  }
  await cart.save();

  res.json({ cart: await buildCartView(req.user!.uid) });
});

const updateSchema = z.object({
  qty: z.number().int().min(0).optional(),
  /** Swap the line to a different variant (size change) of the same product. */
  newSku: z.string().optional(),
});

router.patch("/items/:sku", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });

  const cart = await getOrCreateCart(req.user!.uid);
  const line = cart.items.find((l) => l.sku === req.params.sku);
  if (!line) return res.status(404).json({ error: "Item not in bag" });

  const product = await Product.findOne({ _id: line.product, status: "PUBLISHED" }).lean();
  if (!product) return res.status(404).json({ error: "Product no longer available" });

  const targetSku = parsed.data.newSku ?? line.sku;
  const variant = product.variants.find((v) => v.sku === targetSku);
  if (!variant) return res.status(404).json({ error: "That size is not available" });

  const qty = parsed.data.qty ?? line.qty;
  if (qty === 0) {
    cart.items = cart.items.filter((l) => l.sku !== req.params.sku) as typeof cart.items;
  } else {
    if (qty > variant.stock) return res.status(400).json({ error: `Only ${variant.stock} in stock` });
    // Merge if a line for the target SKU already exists.
    if (targetSku !== line.sku) {
      const clash = cart.items.find((l) => l.sku === targetSku);
      if (clash) {
        if (clash.qty + qty > variant.stock) {
          return res.status(400).json({ error: `Only ${variant.stock} in stock` });
        }
        clash.qty += qty;
        cart.items = cart.items.filter((l) => l.sku !== req.params.sku) as typeof cart.items;
      } else {
        line.sku = targetSku;
        line.qty = qty;
      }
    } else {
      line.qty = qty;
    }
  }
  await cart.save();

  res.json({ cart: await buildCartView(req.user!.uid) });
});

router.delete("/items/:sku", async (req, res) => {
  const cart = await getOrCreateCart(req.user!.uid);
  cart.items = cart.items.filter((l) => l.sku !== req.params.sku) as typeof cart.items;
  await cart.save();
  res.json({ cart: await buildCartView(req.user!.uid) });
});

router.post("/items/:sku/save-for-later", async (req, res) => {
  const cart = await getOrCreateCart(req.user!.uid);
  const line = cart.items.find((l) => l.sku === req.params.sku);
  if (!line) return res.status(404).json({ error: "Item not in bag" });

  cart.items = cart.items.filter((l) => l.sku !== req.params.sku) as typeof cart.items;
  if (!cart.savedItems.some((l) => l.sku === line.sku)) {
    cart.savedItems.push({ product: line.product, sku: line.sku } as (typeof cart.savedItems)[number]);
  }
  await cart.save();
  res.json({ cart: await buildCartView(req.user!.uid) });
});

router.post("/saved/:sku/move-to-bag", async (req, res) => {
  const cart = await getOrCreateCart(req.user!.uid);
  const line = cart.savedItems.find((l) => l.sku === req.params.sku);
  if (!line) return res.status(404).json({ error: "Item not in saved list" });

  const product = await Product.findOne({ _id: line.product, status: "PUBLISHED" }).lean();
  const variant = product?.variants.find((v) => v.sku === line.sku);
  if (!product || !variant || variant.stock < 1) {
    return res.status(400).json({ error: "This item is out of stock" });
  }

  cart.savedItems = cart.savedItems.filter((l) => l.sku !== req.params.sku) as typeof cart.savedItems;
  const existing = cart.items.find((l) => l.sku === line.sku);
  if (existing) {
    if (existing.qty + 1 <= variant.stock) existing.qty += 1;
  } else {
    cart.items.push({ product: line.product, sku: line.sku, qty: 1 } as (typeof cart.items)[number]);
  }
  await cart.save();
  res.json({ cart: await buildCartView(req.user!.uid) });
});

router.delete("/saved/:sku", async (req, res) => {
  const cart = await getOrCreateCart(req.user!.uid);
  cart.savedItems = cart.savedItems.filter((l) => l.sku !== req.params.sku) as typeof cart.savedItems;
  await cart.save();
  res.json({ cart: await buildCartView(req.user!.uid) });
});

const couponSchema = z.object({ code: z.string().min(1) });

router.post("/coupon", async (req, res) => {
  const parsed = couponSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a coupon code" });

  const coupon = await Coupon.findOne({ code: parsed.data.code.toUpperCase().trim() });
  if (!coupon) return res.status(404).json({ error: "Coupon not found" });

  const result = await evaluateCouponForUser(req.user!.uid, coupon);
  if ("reason" in result) return res.status(400).json({ error: result.reason });

  const cart = await getOrCreateCart(req.user!.uid);
  cart.coupon = coupon._id;
  await cart.save();

  res.json({ cart: await buildCartView(req.user!.uid) });
});

router.delete("/coupon", async (req, res) => {
  const cart = await getOrCreateCart(req.user!.uid);
  cart.coupon = undefined;
  await cart.save();
  res.json({ cart: await buildCartView(req.user!.uid) });
});

/** Every currently-applicable coupon for this user's cart, for the
 * "Available coupons" bottom sheet. */
router.get("/coupons/available", async (req, res) => {
  const candidates = await Coupon.find({ active: true });
  const results = await evaluateCouponsForUser(req.user!.uid, candidates);

  const available: { code: string; type: string; value: number; maxDiscount?: number; minOrderValue: number; discount: number; description: string }[] = [];
  for (const c of candidates) {
    const result = results.get(String(c._id));
    if (result && "discount" in result && result.discount > 0) {
      available.push({
        code: c.code,
        type: c.type,
        value: c.value,
        maxDiscount: c.maxDiscount ?? undefined,
        minOrderValue: c.minOrderValue ?? 0,
        discount: result.discount,
        description:
          c.type === "PERCENTAGE"
            ? `${c.value}% off${c.maxDiscount ? ` up to ₹${c.maxDiscount}` : ""}`
            : `₹${c.value} off`,
      });
    }
  }
  available.sort((a, b) => b.discount - a.discount);
  res.json({ coupons: available });
});

export default router;
