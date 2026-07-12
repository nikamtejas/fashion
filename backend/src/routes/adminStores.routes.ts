import { Router } from "express";
import { z } from "zod";
import { StoreLocation } from "../models/StoreLocation";
import { requireAdmin } from "../middleware/auth";

const router = Router();
router.use(requireAdmin);

router.get("/", async (_req, res) => {
  const stores = await StoreLocation.find().sort({ name: 1 }).lean();
  res.json({ stores });
});

const pickupConfigSchema = z.object({
  windows: z
    .array(z.object({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) }))
    .min(1),
  capacityPerSlot: z.number().int().min(1).max(50),
  sameDayReadyHours: z.number().min(0).max(24),
});

router.patch("/:id/pickup-config", async (req, res) => {
  const parsed = pickupConfigSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid config" });

  const store = await StoreLocation.findById(req.params.id);
  if (!store) return res.status(404).json({ error: "Store not found" });

  store.pickupConfig = parsed.data as typeof store.pickupConfig;
  await store.save();
  res.json({ store });
});

export default router;
