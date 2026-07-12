import { Router } from "express";
import { z } from "zod";
import { getSettings } from "../models/Settings";
import { requireAdmin } from "../middleware/auth";

const router = Router();
router.use(requireAdmin);

router.get("/", async (_req, res) => {
  const settings = await getSettings();
  res.json({ settings });
});

const patchSchema = z.object({
  emiMinimumOrderValue: z.number().min(0).optional(),
  codMaxOrderValue: z.number().min(0).optional(),
  codConvenienceFee: z.number().min(0).optional(),
});

router.patch("/", async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid settings" });

  const settings = await getSettings();
  Object.assign(settings, parsed.data);
  await settings.save();
  res.json({ settings });
});

export default router;
