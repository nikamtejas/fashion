import { Router } from "express";
import { z } from "zod";
import { Product } from "../models/Product";
import { stylistChat, generateTryOn } from "../lib/integrations/gemini";
import { cloudinaryUrl } from "../lib/cloudinary";

const router = Router();

const chatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(1000) }))
    .min(1)
    .max(20),
});

/** "Ask Loom" — stylist chat with catalog context and shoppable cards. */
router.post("/chat", async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Say something for Loom to work with" });

  const products = await Product.find({ status: "PUBLISHED" })
    .select("slug name pricing.finalPrice category tags images variants")
    .populate("category", "name")
    .limit(60)
    .lean();

  const catalog = products.map((p) => ({
    slug: p.slug,
    name: p.name,
    price: p.pricing?.finalPrice ?? 0,
    category: (p.category as unknown as { name?: string })?.name ?? "",
    tags: p.tags ?? [],
  }));

  const result = await stylistChat(parsed.data.messages, catalog);

  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const cards = result.slugs
    .map((slug) => bySlug.get(slug))
    .filter(Boolean)
    .map((p) => ({
      slug: p!.slug,
      name: p!.name,
      price: p!.pricing?.finalPrice ?? 0,
      image: p!.images?.[0]?.publicId ? cloudinaryUrl(p!.images[0].publicId, 300) : null,
      inStock: p!.variants.some((v) => v.stock > 0),
    }));

  res.json({ reply: result.reply, products: cards });
});

/** Virtual try-on-lite: garment on a model backdrop, clearly AI-labeled. */
router.post("/try-on", async (req, res) => {
  const slug = String(req.body?.slug ?? "");
  const product = await Product.findOne({ slug, status: "PUBLISHED" }).select("name images").lean();
  if (!product) return res.status(404).json({ error: "Product not found" });

  const source =
    product.images.find((i) => i.type === "STUDIO" && i.side === "FRONT") ??
    product.images.find((i) => i.type === "ORIGINAL" && i.side === "FRONT") ??
    product.images[0];
  if (!source) return res.status(400).json({ error: "This product has no photos yet" });

  try {
    const imgRes = await fetch(source.secureUrl);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const result = await generateTryOn(
      { base64: buf.toString("base64"), mimeType: imgRes.headers.get("content-type") ?? "image/jpeg" },
      product.name
    );
    res.json({ image: `data:${result.mimeType};base64,${result.base64}`, aiGenerated: true });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Try-on generation failed" });
  }
});

export default router;
