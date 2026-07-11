import { Router } from "express";
import { Product } from "../models/Product";
import { cloudinaryUrl } from "../lib/cloudinary";

const router = Router();

function serializeProduct(p: {
  _id: unknown;
  name: string;
  slug: string;
  images: { publicId: string; type: string }[];
  pricing?: { finalPrice?: number | null; mrp?: number | null } | null;
}) {
  return {
    id: String(p._id),
    name: p.name,
    slug: p.slug,
    price: p.pricing?.finalPrice ?? 0,
    mrp: p.pricing?.mrp ?? undefined,
    image: p.images?.[0]?.publicId ? cloudinaryUrl(p.images[0].publicId, 600) : null,
  };
}

router.get("/", async (req, res) => {
  const { sort = "new", limit = "20", category } = req.query as Record<string, string>;

  const query: Record<string, unknown> = { status: "PUBLISHED" };
  if (category) query.category = category;

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    new: { createdAt: -1 },
    price_asc: { "pricing.finalPrice": 1 },
    price_desc: { "pricing.finalPrice": -1 },
  };

  const products = await Product.find(query)
    .sort(sortMap[sort] ?? sortMap.new)
    .limit(Math.min(Number(limit) || 20, 50))
    .select("name slug images pricing.finalPrice pricing.mrp")
    .lean();

  res.json({ products: products.map(serializeProduct) });
});

router.get("/:slug", async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, status: "PUBLISHED" }).lean();
  if (!product) return res.status(404).json({ error: "Product not found" });

  res.json({
    product: {
      ...product,
      id: String(product._id),
      images: product.images.map((img) => ({
        ...img,
        url: cloudinaryUrl(img.publicId, 1200),
      })),
    },
  });
});

export default router;
