import { Router } from "express";
import { z } from "zod";
import { requireCatalog } from "../middleware/auth";
import { Lookbook } from "../models/Lookbook";
import { cloudinaryUrl } from "../lib/cloudinary";

const router = Router();
router.use(requireCatalog);

router.get("/", async (_req, res) => {
  const lookbooks = await Lookbook.find().sort({ order: 1, createdAt: -1 }).populate("products", "name slug images").lean();
  res.json({
    lookbooks: lookbooks.map((l) => ({
      ...l,
      products: l.products.map((p) => ({
        ...p,
        images: (p as unknown as { images?: { publicId?: string }[] }).images?.map((img) => ({
          ...img,
          thumbUrl: img.publicId ? cloudinaryUrl(img.publicId, 80) : undefined,
        })),
      })),
    })),
  });
});

const lookbookSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  products: z.array(z.string()).min(1),
  active: z.boolean().default(true),
});

router.post("/", async (req, res) => {
  const parsed = lookbookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid lookbook" });
  const lookbook = await Lookbook.create(parsed.data);
  res.status(201).json({ lookbook });
});

router.patch("/:id", async (req, res) => {
  const parsed = lookbookSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid lookbook" });
  const lookbook = await Lookbook.findByIdAndUpdate(req.params.id, parsed.data, { new: true });
  if (!lookbook) return res.status(404).json({ error: "Lookbook not found" });
  res.json({ lookbook });
});

router.delete("/:id", async (req, res) => {
  const result = await Lookbook.deleteOne({ _id: req.params.id });
  if (result.deletedCount === 0) return res.status(404).json({ error: "Lookbook not found" });
  res.json({ ok: true });
});

export default router;
