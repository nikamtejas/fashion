import { Router } from "express";
import { z } from "zod";
import { Product } from "../models/Product";
import { requireCatalog } from "../middleware/auth";
import { slugify } from "../lib/slugify";
import { computePricing } from "../lib/pricing";
import { uploadImage, productFolder, cloudinaryUrl } from "../lib/cloudinary";
import { checkAlertsForProduct } from "../services/alerts.service";

const router = Router();
router.use(requireCatalog);

router.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);

  const [products, total] = await Promise.all([
    Product.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("name slug status images pricing.finalPrice category createdAt")
      .populate("category", "name")
      .lean(),
    Product.countDocuments(),
  ]);

  res.json({
    // Consumers range from a 40px table row thumbnail to a ~200px lookbook
    // picker tile — 200px covers the largest at 1x and the smallest at
    // retina density, instead of falling back to the full-res secureUrl
    // (see cloudinaryUrl() doc comment).
    products: products.map((p) => ({
      ...p,
      images: p.images?.map((img) => ({ ...img, thumbUrl: img.publicId ? cloudinaryUrl(img.publicId, 200) : undefined })),
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

const detailsSchema = z.object({
  name: z.string().min(2),
  category: z.string(),
  gender: z.enum(["MEN", "WOMEN", "UNISEX"]).default("UNISEX"),
  brand: z.string().default("LuxeLoom"),
  tags: z.array(z.string()).default([]),
  description: z.string().default(""),
});

router.post("/", async (req, res) => {
  const parsed = detailsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });

  const baseSlug = slugify(parsed.data.name);
  let slug = baseSlug;
  let i = 1;
  while (await Product.exists({ slug })) {
    slug = `${baseSlug}-${++i}`;
  }

  const product = await Product.create({ ...parsed.data, slug, status: "DRAFT" });
  res.status(201).json({ product });
});

router.get("/:id", async (req, res) => {
  const product = await Product.findById(req.params.id).populate("category", "name slug");
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json({ product });
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  category: z.string().optional(),
  gender: z.enum(["MEN", "WOMEN", "UNISEX"]).optional(),
  brand: z.string().optional(),
  tags: z.array(z.string()).optional(),
  description: z.string().optional(),
  variants: z
    .array(
      z.object({
        size: z.string(),
        color: z.string(),
        colorHex: z.string().optional(),
        sku: z.string(),
        stock: z.number().min(0),
      })
    )
    .optional(),
  pricing: z
    .object({
      purchasePrice: z.number().min(0),
      marginType: z.enum(["PERCENTAGE", "FLAT"]),
      marginValue: z.number().min(0),
      fixedCosts: z.array(z.object({ name: z.string(), value: z.number().min(0) })).default([]),
      customParams: z.array(z.object({ name: z.string(), value: z.number().min(0) })).default([]),
      gstRate: z.union([z.literal(5), z.literal(12), z.literal(18)]).optional(),
      gstInclusive: z.boolean().default(false),
      taxType: z.enum(["CGST_SGST", "IGST"]).default("CGST_SGST"),
      mrp: z.number().min(0).optional(),
    })
    .optional(),
});

router.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });

  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });

  const { pricing, ...rest } = parsed.data;
  Object.assign(product, rest);

  if (pricing) {
    // Server always recomputes the breakdown from raw inputs — any derived
    // values a client might send are ignored by the schema above.
    product.pricing = computePricing(pricing) as unknown as typeof product.pricing;
  }

  await product.save();
  // Price drops / restocks may satisfy armed customer alerts.
  checkAlertsForProduct(String(product._id)).catch((e) => console.error("alert check failed:", e));
  res.json({ product });
});

router.post("/:id/publish", async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });

  if (product.images.length === 0) {
    return res.status(400).json({ error: "Add at least one photo before publishing" });
  }
  if (product.variants.length === 0) {
    return res.status(400).json({ error: "Add at least one size/color variant before publishing" });
  }
  if ((product.images as unknown as { faithfulnessFlag?: boolean }[]).some((img) => img.faithfulnessFlag)) {
    return res.status(400).json({ error: "Resolve the mismatch-flagged photo before publishing" });
  }

  product.status = "PUBLISHED";
  await product.save();
  res.json({ product });
});

const imageUploadSchema = z.object({
  dataUri: z.string().startsWith("data:image/"),
  side: z.enum(["FRONT", "BACK"]).optional(),
  type: z.enum(["ORIGINAL", "STUDIO", "AI_MODEL"]).default("ORIGINAL"),
  slot: z.enum(["MODEL_FRONT", "LIFESTYLE"]).optional(),
  color: z.string().optional(),
  altText: z.string().optional(),
  replaceImageId: z.string().optional(),
});

const MAX_IMAGES_PER_COLOR = 4;

router.post("/:id/images", async (req, res) => {
  const parsed = imageUploadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid image payload" });

  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });

  if (parsed.data.color && !parsed.data.replaceImageId) {
    const existingForColor = product.images.filter((img) => img.color === parsed.data.color).length;
    if (existingForColor >= MAX_IMAGES_PER_COLOR) {
      return res.status(400).json({ error: `${parsed.data.color} already has the maximum of ${MAX_IMAGES_PER_COLOR} photos` });
    }
  }

  const uploaded = await uploadImage(parsed.data.dataUri, { folder: productFolder(product.slug) });

  if (parsed.data.replaceImageId) {
    product.images = product.images.filter(
      (img) => String((img as unknown as { _id: unknown })._id) !== parsed.data.replaceImageId
    ) as typeof product.images;
  } else if (parsed.data.side) {
    // A new FRONT/BACK original replaces any existing one for that side.
    product.images = product.images.filter(
      (img) => !(img.type === "ORIGINAL" && img.side === parsed.data.side)
    ) as typeof product.images;
  }

  product.images.push({
    publicId: uploaded.publicId,
    secureUrl: uploaded.secureUrl,
    type: parsed.data.type,
    side: parsed.data.side,
    slot: parsed.data.slot,
    color: parsed.data.color,
    altText: parsed.data.altText,
    order: product.images.length,
  } as (typeof product.images)[number]);
  await product.save();

  res.status(201).json({ product });
});

router.delete("/:id/images/:imageId", async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });

  product.images = product.images.filter(
    (img) => String((img as unknown as { _id: unknown })._id) !== req.params.imageId
  ) as typeof product.images;
  await product.save();

  res.json({ product });
});

/** Marks one image as the storefront cover (poster on shop cards, first
 * gallery photo) — exclusive, so the flag is cleared on every other image. */
router.patch("/:id/images/:imageId/cover", async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });

  const target = product.images.find(
    (img) => String((img as unknown as { _id: unknown })._id) === req.params.imageId
  );
  if (!target) return res.status(404).json({ error: "Image not found" });

  for (const img of product.images) {
    img.isCover = img === target;
  }
  await product.save();

  res.json({ product });
});

const reorderSchema = z.object({ imageIds: z.array(z.string()) });

router.patch("/:id/images/reorder", async (req, res) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid reorder payload" });

  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });

  const order = new Map(parsed.data.imageIds.map((id, i) => [id, i]));
  for (const img of product.images) {
    const id = String((img as unknown as { _id: unknown })._id);
    if (order.has(id)) (img as unknown as { order: number }).order = order.get(id)!;
  }
  product.images.sort((a, b) => a.order - b.order);
  await product.save();

  res.json({ product });
});

export default router;
