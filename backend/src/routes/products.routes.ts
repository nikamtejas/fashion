import { Router } from "express";
import { Product } from "../models/Product";
import { Category } from "../models/Category";
import { Review } from "../models/Review";
import { requireAuth } from "../middleware/auth";
import { cloudinaryUrl } from "../lib/cloudinary";
import { z } from "zod";

const router = Router();

function serializeProduct(p: {
  _id: unknown;
  name: string;
  slug: string;
  images: { publicId: string; type: string; side?: string | null; isCover?: boolean | null }[];
  pricing?: { finalPrice?: number | null; mrp?: number | null } | null;
  variants?: { size: string; color: string; colorHex?: string | null; stock: number }[];
}) {
  const images = p.images ?? [];
  // Poster: an admin-chosen cover wins; otherwise prefer the generated sales
  // shots — the casual ORIGINAL uploads sit first in the array (generated
  // photos are appended after them) and must not leak onto the shop card.
  const poster =
    images.find((img) => img.isCover) ??
    images.find((img) => img.type === "STUDIO" && img.side === "FRONT") ??
    images.find((img) => img.type !== "ORIGINAL") ??
    images[0];
  const hoverImage =
    images.find((img) => img.type === "AI_MODEL" && img !== poster) ?? images.find((img) => img !== poster);
  return {
    id: String(p._id),
    name: p.name,
    slug: p.slug,
    price: p.pricing?.finalPrice ?? 0,
    mrp: p.pricing?.mrp ?? undefined,
    image: poster?.publicId ? cloudinaryUrl(poster.publicId, 600) : null,
    hoverImage: hoverImage?.publicId ? cloudinaryUrl(hoverImage.publicId, 600) : null,
    sizes: [...new Set((p.variants ?? []).map((v) => v.size))],
    colors: [...new Map((p.variants ?? []).map((v) => [v.color, v.colorHex])).entries()].map(([name, hex]) => ({
      name,
      hex,
    })),
    inStock: (p.variants ?? []).some((v) => v.stock > 0),
  };
}

router.get("/", async (req, res) => {
  const {
    sort = "new",
    limit = "20",
    page = "1",
    category,
    sub,
    size,
    color,
    minPrice,
    maxPrice,
    q,
    slugs,
  } = req.query as Record<string, string>;

  const query: Record<string, unknown> = { status: "PUBLISHED" };
  if (slugs) query.slug = { $in: slugs.split(",").map((s) => s.trim()).filter(Boolean) };

  if (category) {
    const cat = await Category.findOne({ slug: category }).select("_id").lean();
    if (!cat) return res.json({ products: [], total: 0, page: 1, pages: 0 });
    query.category = cat._id;
  }
  // MegaMenu subcategory links (e.g. ?category=men&sub=shirts) match against
  // the product's tags — the sub slug is stored verbatim as one of the tags.
  if (sub) query.tags = sub;
  if (size) query["variants.size"] = { $in: size.split(",") };
  if (color) query["variants.color"] = { $in: color.split(",") };
  if (minPrice || maxPrice) {
    query["pricing.finalPrice"] = {
      ...(minPrice ? { $gte: Number(minPrice) } : {}),
      ...(maxPrice ? { $lte: Number(maxPrice) } : {}),
    };
  }
  if (q) query.name = { $regex: q, $options: "i" };

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    new: { createdAt: -1 },
    price_asc: { "pricing.finalPrice": 1 },
    price_desc: { "pricing.finalPrice": -1 },
  };

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(50, Number(limit) || 20);

  const [products, total] = await Promise.all([
    Product.find(query)
      .sort(sortMap[sort] ?? sortMap.new)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .select("name slug images pricing.finalPrice pricing.mrp variants")
      .lean(),
    Product.countDocuments(query),
  ]);

  res.json({
    products: products.map(serializeProduct),
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    hasMore: pageNum * limitNum < total,
  });
});

router.get("/:slug", async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, status: "PUBLISHED" })
    .populate("category", "name slug")
    .lean();
  if (!product) return res.status(404).json({ error: "Product not found" });

  res.json({
    product: {
      ...product,
      id: String(product._id),
      images: product.images.map((img) => ({
        ...img,
        url: cloudinaryUrl(img.publicId, 1200),
        thumbUrl: cloudinaryUrl(img.publicId, 128),
      })),
    },
  });
});

router.get("/:slug/complete-the-look", async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, status: "PUBLISHED" }).select("category gender").lean();
  if (!product) return res.status(404).json({ error: "Product not found" });

  const pairs = await Product.find({
    status: "PUBLISHED",
    slug: { $ne: req.params.slug },
    category: { $ne: product.category },
    gender: { $in: [product.gender, "UNISEX"] },
  })
    .sort({ createdAt: -1 })
    .limit(4)
    .select("name slug images pricing.finalPrice pricing.mrp variants")
    .lean();

  res.json({ products: pairs.map(serializeProduct) });
});

router.get("/:slug/reviews", async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug }).select("_id").lean();
  if (!product) return res.status(404).json({ error: "Product not found" });

  const reviews = await Review.find({ product: product._id, status: "APPROVED" })
    .populate("user", "name")
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    reviews: reviews.map((r) => ({
      id: String(r._id),
      rating: r.rating,
      title: r.title,
      body: r.body,
      photos: r.photos,
      verifiedPurchase: r.verifiedPurchase,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userName: (r.user as any)?.name ?? "LuxeLoom customer",
      createdAt: r.createdAt,
    })),
  });
});

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  title: z.string().optional(),
  body: z.string().min(1),
  photoDataUris: z.array(z.string().startsWith("data:image/")).max(4).optional(),
});

router.post("/:slug/reviews", requireAuth, async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid review" });

  const product = await Product.findOne({ slug: req.params.slug }).select("_id").lean();
  if (!product) return res.status(404).json({ error: "Product not found" });

  // Verified purchase: the reviewer has a delivered order containing this product.
  const { Order } = await import("../models/Order.js");
  const verifiedPurchase = Boolean(
    await Order.exists({ user: req.user!.uid, status: "DELIVERED", "items.product": product._id })
  );

  const photos: { publicId: string; secureUrl: string }[] = [];
  for (const dataUri of parsed.data.photoDataUris ?? []) {
    const { uploadImage } = await import("../lib/cloudinary.js");
    const uploaded = await uploadImage(dataUri, { folder: `luxeloom/reviews/${req.params.slug}` });
    photos.push({ publicId: uploaded.publicId, secureUrl: uploaded.secureUrl });
  }

  const review = await Review.create({
    product: product._id,
    user: req.user!.uid,
    rating: parsed.data.rating,
    title: parsed.data.title,
    body: parsed.data.body,
    photos,
    verifiedPurchase,
    status: "PENDING", // published after admin moderation
  });

  res.status(201).json({ review, pending: true });
});

export default router;
