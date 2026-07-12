import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { Alert } from "../models/Alert";
import { Product } from "../models/Product";

const router = Router();
router.use(requireAuth);

const subscribeSchema = z.object({
  productId: z.string(),
  type: z.enum(["PRICE_DROP", "BACK_IN_STOCK"]),
});

router.post("/", async (req, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid alert request" });

  const product = await Product.findOne({ _id: parsed.data.productId, status: "PUBLISHED" })
    .select("pricing.finalPrice")
    .lean();
  if (!product) return res.status(404).json({ error: "Product not found" });

  await Alert.updateOne(
    { user: req.user!.uid, product: parsed.data.productId, type: parsed.data.type },
    {
      $set: {
        active: true,
        ...(parsed.data.type === "PRICE_DROP" ? { priceAtSubscribe: product.pricing?.finalPrice ?? 0 } : {}),
      },
    },
    { upsert: true }
  );
  res.json({ ok: true });
});

/** Which alerts the caller has armed for a product (for button states). */
router.get("/product/:productId", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.productId)) return res.json({ types: [] });
  const alerts = await Alert.find({
    user: new mongoose.Types.ObjectId(req.user!.uid),
    product: new mongoose.Types.ObjectId(req.params.productId),
    active: true,
  })
    .select("type")
    .lean();
  res.json({ types: alerts.map((a) => a.type) });
});

router.delete("/:productId/:type", async (req, res) => {
  const type = req.params.type === "BACK_IN_STOCK" ? "BACK_IN_STOCK" : "PRICE_DROP";
  await Alert.updateOne({ user: req.user!.uid, product: req.params.productId, type }, { active: false });
  res.json({ ok: true });
});

export default router;
