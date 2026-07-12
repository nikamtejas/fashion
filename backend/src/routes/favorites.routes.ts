import { Router } from "express";
import { Favorite } from "../models/Favorite";
import { Product } from "../models/Product";
import { requireAuth } from "../middleware/auth";
import { cloudinaryUrl } from "../lib/cloudinary";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const favorites = await Favorite.find({ user: req.user!.uid })
    .populate({ path: "product", select: "name slug images pricing.finalPrice pricing.mrp variants status" })
    .sort({ createdAt: -1 })
    .lean();

  const products = favorites
    .filter((f) => f.product)
    .map((f) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = f.product as any;
      return {
        id: String(p._id),
        name: p.name,
        slug: p.slug,
        price: p.pricing?.finalPrice ?? 0,
        mrp: p.pricing?.mrp ?? undefined,
        image: p.images?.[0]?.publicId ? cloudinaryUrl(p.images[0].publicId, 600) : null,
        inStock: (p.variants ?? []).some((v: { stock: number }) => v.stock > 0),
        status: p.status,
      };
    });

  res.json({ favorites: products });
});

router.post("/:productId", async (req, res) => {
  const product = await Product.findById(req.params.productId).select("_id");
  if (!product) return res.status(404).json({ error: "Product not found" });

  await Favorite.updateOne(
    { user: req.user!.uid, product: product._id },
    { $setOnInsert: { user: req.user!.uid, product: product._id } },
    { upsert: true }
  );
  res.json({ ok: true, favorited: true });
});

router.delete("/:productId", async (req, res) => {
  await Favorite.deleteOne({ user: req.user!.uid, product: req.params.productId });
  res.json({ ok: true, favorited: false });
});

router.get("/ids", async (req, res) => {
  const favorites = await Favorite.find({ user: req.user!.uid }).select("product").lean();
  res.json({ ids: favorites.map((f) => String(f.product)) });
});

export default router;
