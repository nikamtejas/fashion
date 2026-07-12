import { Router } from "express";
import { z } from "zod";
import { Coupon } from "../models/Coupon";
import { requireAdmin } from "../middleware/auth";

const router = Router();
router.use(requireAdmin);

router.get("/", async (_req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
  res.json({ coupons });
});

const couponSchema = z.object({
  code: z.string().min(2).transform((s) => s.toUpperCase().trim()),
  type: z.enum(["FLAT", "PERCENTAGE"]),
  value: z.number().positive(),
  maxDiscount: z.number().positive().optional().nullable(),
  minOrderValue: z.number().min(0).default(0),
  usageLimit: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().default(1),
  expiresAt: z.string().datetime().optional().nullable(),
  applicableCategories: z.array(z.string()).default([]),
  applicableProducts: z.array(z.string()).default([]),
  firstOrderOnly: z.boolean().default(false),
  active: z.boolean().default(true),
});

router.post("/", async (req, res) => {
  const parsed = couponSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid coupon" });

  if (await Coupon.exists({ code: parsed.data.code })) {
    return res.status(409).json({ error: "A coupon with this code already exists" });
  }

  const coupon = await Coupon.create({
    ...parsed.data,
    maxDiscount: parsed.data.maxDiscount ?? undefined,
    usageLimit: parsed.data.usageLimit ?? undefined,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
  });
  res.status(201).json({ coupon });
});

router.patch("/:id", async (req, res) => {
  const parsed = couponSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid coupon" });

  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return res.status(404).json({ error: "Coupon not found" });

  const { expiresAt, maxDiscount, usageLimit, ...rest } = parsed.data;
  Object.assign(coupon, rest);
  if (expiresAt !== undefined) coupon.expiresAt = expiresAt ? new Date(expiresAt) : undefined;
  if (maxDiscount !== undefined) coupon.maxDiscount = maxDiscount ?? undefined;
  if (usageLimit !== undefined) coupon.usageLimit = usageLimit ?? undefined;
  await coupon.save();

  res.json({ coupon });
});

router.delete("/:id", async (req, res) => {
  const result = await Coupon.deleteOne({ _id: req.params.id });
  if (result.deletedCount === 0) return res.status(404).json({ error: "Coupon not found" });
  res.json({ ok: true });
});

export default router;
