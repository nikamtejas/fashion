import { Router } from "express";
import { StoreLocation, DEFAULT_PICKUP_CONFIG } from "../models/StoreLocation";
import { PickupAppointment } from "../models/PickupAppointment";
import { geocodePincode, lookupPincode } from "../lib/integrations/pincode";
import { checkServiceability } from "../lib/integrations/bluedart";
import { attachUser } from "../middleware/auth";
import { getOrCreateCart } from "../services/cart.service";
import { Product } from "../models/Product";

const router = Router();

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)) * 10) / 10;
}

const DAY_KEYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

function todayHours(store: { hours: { day: string; open: string; close: string }[] }) {
  const today = DAY_KEYS[new Date().getDay()];
  const h = store.hours.find((x) => x.day === today);
  if (!h) return { open: null as string | null, close: null as string | null, isOpen: false };
  const now = new Date();
  const [oh, om] = h.open.split(":").map(Number);
  const [ch, cm] = h.close.split(":").map(Number);
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return { open: h.open, close: h.close, isOpen: nowMin >= openMin && nowMin < closeMin };
}

/**
 * Per-store stock status of the current cart. There is no real per-store
 * inventory yet (Product.variants.stock is global) — this derives a
 * deterministic, stable pseudo-availability per (store, sku) so the
 * MediaMarkt-style "All items in stock here" / "needs transfer" states are
 * demoable. Real per-store inventory would replace `inStockAtStore`.
 */
function inStockAtStore(storeId: string, sku: string): boolean {
  const s = storeId + sku;
  const hash = [...s].reduce((sum, c, i) => (sum * 31 + c.charCodeAt(0) * (i + 1)) % 997, 7);
  return hash % 5 !== 0; // ~80% of (store, sku) pairs are in stock locally
}

router.get("/", async (_req, res) => {
  const stores = await StoreLocation.find({ active: true }).lean();
  res.json({
    stores: stores.map((s) => ({
      id: String(s._id),
      name: s.name,
      address: s.address,
      city: s.city,
      state: s.state,
      pincode: s.pincode,
      lat: s.lat,
      lng: s.lng,
      phone: s.phone,
      today: todayHours(s),
    })),
  });
});

router.get("/nearby", attachUser, async (req, res) => {
  const pincode = req.query.pincode as string | undefined;
  const lat = req.query.lat ? Number(req.query.lat) : undefined;
  const lng = req.query.lng ? Number(req.query.lng) : undefined;

  let origin: { lat: number; lng: number } | null = null;
  if (lat !== undefined && lng !== undefined && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    origin = { lat, lng };
  } else if (pincode) {
    origin = await geocodePincode(pincode);
  }
  if (!origin) {
    return res.status(400).json({ error: "Provide a valid pincode or location" });
  }

  // Cart SKUs (if logged in) for the per-store stock summary.
  let cartSkus: string[] = [];
  if (req.user) {
    const cart = await getOrCreateCart(req.user.uid);
    const products = await Product.find({ _id: { $in: cart.items.map((l) => l.product) } })
      .select("variants.sku")
      .lean();
    const validSkus = new Set(products.flatMap((p) => p.variants.map((v) => v.sku)));
    cartSkus = cart.items.map((l) => l.sku).filter((sku) => validSkus.has(sku));
  }

  const stores = await StoreLocation.find({ active: true }).lean();
  const ranked = stores
    .map((s) => {
      const missing = cartSkus.filter((sku) => !inStockAtStore(String(s._id), sku));
      return {
        id: String(s._id),
        name: s.name,
        address: s.address,
        city: s.city,
        state: s.state,
        pincode: s.pincode,
        lat: s.lat,
        lng: s.lng,
        phone: s.phone,
        distanceKm: haversineKm(origin!, s),
        today: todayHours(s),
        stock:
          cartSkus.length === 0
            ? { status: "UNKNOWN" as const, message: "" }
            : missing.length === 0
              ? { status: "ALL_IN_STOCK" as const, message: "All items in stock here" }
              : {
                  status: "TRANSFER_NEEDED" as const,
                  message: `${missing.length} item${missing.length > 1 ? "s" : ""} need${missing.length > 1 ? "" : "s"} transfer, +1 day`,
                  transferCount: missing.length,
                },
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 3);

  res.json({ origin, stores: ranked });
});

/** Next-7-days pickup slots for a store, with per-slot remaining capacity
 * and same-day readiness. */
router.get("/:id/slots", async (req, res) => {
  const store = await StoreLocation.findById(req.params.id).lean();
  if (!store || !store.active) return res.status(404).json({ error: "Store not found" });

  const config = store.pickupConfig ?? DEFAULT_PICKUP_CONFIG;
  const windows = config.windows?.length ? config.windows : DEFAULT_PICKUP_CONFIG.windows;
  const capacity = config.capacityPerSlot ?? DEFAULT_PICKUP_CONFIG.capacityPerSlot;
  const sameDayReadyHours = config.sameDayReadyHours ?? DEFAULT_PICKUP_CONFIG.sameDayReadyHours;

  const now = new Date();
  const days: { date: string; slots: { label: string; start: string; end: string; remaining: number; available: boolean; sameDayReady?: string }[] }[] = [];

  for (let d = 0; d < 7; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);
    const dateStr = day.toISOString().slice(0, 10);

    const dayStart = new Date(`${dateStr}T00:00:00`);
    const dayEnd = new Date(`${dateStr}T23:59:59`);
    const booked = await PickupAppointment.aggregate([
      {
        $match: {
          storeLocation: store._id,
          date: { $gte: dayStart, $lte: dayEnd },
          status: { $in: ["BOOKED", "READY"] },
        },
      },
      { $group: { _id: "$timeSlot", count: { $sum: 1 } } },
    ]);
    const bookedMap = new Map(booked.map((b) => [b._id as string, b.count as number]));

    const slots = windows.map((w) => {
      const label = `${w.start}-${w.end}`;
      const remaining = Math.max(0, capacity - (bookedMap.get(label) ?? 0));
      const slotStart = new Date(`${dateStr}T${w.start}:00`);
      const isToday = d === 0;
      const readyBy = new Date(now.getTime() + sameDayReadyHours * 60 * 60 * 1000);
      const timeOk = !isToday || slotStart >= readyBy;
      return {
        label,
        start: w.start,
        end: w.end,
        remaining,
        available: remaining > 0 && timeOk && slotStart > now,
        ...(isToday && remaining > 0 && timeOk ? { sameDayReady: `Ready in ${sameDayReadyHours} hours` } : {}),
      };
    });

    days.push({ date: dateStr, slots });
  }

  res.json({ storeId: String(store._id), days });
});

router.get("/serviceability/:pincode", async (req, res) => {
  res.json(await checkServiceability(req.params.pincode));
});

router.get("/pincode-info/:pincode", async (req, res) => {
  const info = await lookupPincode(req.params.pincode);
  if (!info) return res.status(404).json({ error: "Pincode not recognized" });
  res.json(info);
});

export default router;
