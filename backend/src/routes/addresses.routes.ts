import { Router } from "express";
import { z } from "zod";
import { User } from "../models/User";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const addressSchema = z.object({
  label: z.string().default("Home"),
  name: z.string().min(2),
  phone: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit phone number"),
  line1: z.string().min(3),
  line2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
  isDefault: z.boolean().default(false),
});

router.get("/", async (req, res) => {
  const user = await User.findById(req.user!.uid).select("addresses").lean();
  res.json({ addresses: user?.addresses ?? [] });
});

router.post("/", async (req, res) => {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid address" });

  const user = await User.findById(req.user!.uid);
  if (!user) return res.status(404).json({ error: "User not found" });

  if (parsed.data.isDefault || user.addresses.length === 0) {
    user.addresses.forEach((a) => (a.isDefault = false));
    parsed.data.isDefault = true;
  }
  user.addresses.push(parsed.data as (typeof user.addresses)[number]);
  await user.save();

  res.status(201).json({ addresses: user.addresses });
});

router.patch("/:addressId", async (req, res) => {
  const parsed = addressSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid address" });

  const user = await User.findById(req.user!.uid);
  const address = user?.addresses.id(req.params.addressId);
  if (!user || !address) return res.status(404).json({ error: "Address not found" });

  if (parsed.data.isDefault) {
    user.addresses.forEach((a) => (a.isDefault = false));
  }
  Object.assign(address, parsed.data);
  await user.save();

  res.json({ addresses: user.addresses });
});

router.delete("/:addressId", async (req, res) => {
  const user = await User.findById(req.user!.uid);
  const address = user?.addresses.id(req.params.addressId);
  if (!user || !address) return res.status(404).json({ error: "Address not found" });

  address.deleteOne();
  if (user.addresses.length > 0 && !user.addresses.some((a) => a.isDefault)) {
    user.addresses[0].isDefault = true;
  }
  await user.save();

  res.json({ addresses: user.addresses });
});

export default router;
