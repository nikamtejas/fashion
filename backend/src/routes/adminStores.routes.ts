import { Router } from "express";
import { z } from "zod";
import { StoreLocation } from "../models/StoreLocation";
import { geocodePincode } from "../lib/integrations/pincode";
import { requireAdmin } from "../middleware/auth";

const router = Router();
router.use(requireAdmin);

router.get("/", async (_req, res) => {
  const stores = await StoreLocation.find().sort({ name: 1 }).lean();
  res.json({ stores });
});

const DEFAULT_HOURS = (["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const).map((day) => ({
  day,
  open: "10:00",
  close: "20:00",
}));

const createStoreSchema = z.object({
  name: z.string().min(2),
  address: z.string().min(3),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
  phone: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

router.post("/", async (req, res) => {
  const parsed = createStoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid store" });

  let { lat, lng } = parsed.data;
  if (lat === undefined || lng === undefined) {
    const point = await geocodePincode(parsed.data.pincode);
    if (!point) {
      return res.status(400).json({ error: "Couldn't locate that pincode — enter latitude/longitude manually" });
    }
    lat = point.lat;
    lng = point.lng;
  }

  const store = await StoreLocation.create({ ...parsed.data, lat, lng, hours: DEFAULT_HOURS, active: true });
  res.status(201).json({ store });
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
