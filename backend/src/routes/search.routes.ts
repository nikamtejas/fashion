import { Router } from "express";
import { Product } from "../models/Product";
import { cloudinaryUrl } from "../lib/cloudinary";

const router = Router();

router.get("/suggest", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 2) return res.json({ results: [] });

  const products = await Product.find({
    status: "PUBLISHED",
    name: { $regex: q, $options: "i" },
  })
    .select("name slug images pricing.finalPrice")
    .limit(6)
    .lean();

  res.json({
    results: products.map((p) => ({
      name: p.name,
      slug: p.slug,
      price: p.pricing?.finalPrice ?? 0,
      image: p.images?.[0]?.publicId ? cloudinaryUrl(p.images[0].publicId, 100) : null,
    })),
  });
});

export default router;
