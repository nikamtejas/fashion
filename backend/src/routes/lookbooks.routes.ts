import { Router } from "express";
import { Lookbook } from "../models/Lookbook";
import { Product } from "../models/Product";
import { cloudinaryUrl } from "../lib/cloudinary";

const router = Router();

/** Public shop-the-look listing with full product cards per look. */
router.get("/", async (_req, res) => {
  const lookbooks = await Lookbook.find({ active: true }).sort({ order: 1, createdAt: -1 }).lean();
  const productIds = [...new Set(lookbooks.flatMap((l) => l.products.map(String)))];
  const products = await Product.find({ _id: { $in: productIds }, status: "PUBLISHED" })
    .select("name slug images pricing.finalPrice pricing.mrp variants")
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  res.json({
    lookbooks: lookbooks.map((l) => ({
      id: String(l._id),
      title: l.title,
      description: l.description,
      coverImage: l.coverImage?.secureUrl ?? null,
      products: l.products
        .map((pid) => byId.get(String(pid)))
        .filter(Boolean)
        .map((p) => ({
          id: String(p!._id),
          name: p!.name,
          slug: p!.slug,
          price: p!.pricing?.finalPrice ?? 0,
          image: p!.images?.[0]?.publicId ? cloudinaryUrl(p!.images[0].publicId, 400) : null,
          firstInStockSku: p!.variants.find((v) => v.stock > 0)?.sku ?? null,
        })),
    })),
  });
});

export default router;
