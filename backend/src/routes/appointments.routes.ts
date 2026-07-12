import { Router } from "express";
import { z } from "zod";
import { PickupAppointment } from "../models/PickupAppointment";
import { Order } from "../models/Order";
import { StoreLocation, DEFAULT_PICKUP_CONFIG } from "../models/StoreLocation";
import { requireAuth } from "../middleware/auth";
import { buildIcs } from "../lib/appointments";

const router = Router();
router.use(requireAuth);

/** Loads the appointment only if it belongs to one of the caller's orders. */
async function loadOwnAppointment(appointmentId: string, userId: string) {
  const appt = await PickupAppointment.findById(appointmentId);
  if (!appt) return null;
  const order = await Order.findOne({ _id: appt.order, user: userId }).select("_id orderNumber");
  return order ? { appt, order } : null;
}

router.get("/:id/ics", async (req, res) => {
  const found = await loadOwnAppointment(req.params.id, req.user!.uid);
  if (!found) return res.status(404).json({ error: "Appointment not found" });

  const store = await StoreLocation.findById(found.appt.storeLocation).lean();
  const ics = buildIcs({
    orderNumber: found.order.orderNumber,
    storeName: store?.name ?? "LuxeLoom Store",
    storeAddress: store ? `${store.address}, ${store.city}` : "",
    date: found.appt.date,
    timeSlot: found.appt.timeSlot,
  });

  res.setHeader("Content-Type", "text/calendar");
  res.setHeader("Content-Disposition", `attachment; filename="luxeloom-pickup-${found.order.orderNumber}.ics"`);
  res.send(ics);
});

const rescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeSlot: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
});

router.patch("/:id", async (req, res) => {
  const parsed = rescheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Pick a valid date and slot" });

  const found = await loadOwnAppointment(req.params.id, req.user!.uid);
  if (!found) return res.status(404).json({ error: "Appointment not found" });
  if (!["BOOKED", "READY"].includes(found.appt.status)) {
    return res.status(400).json({ error: "This appointment can no longer be changed" });
  }

  const store = await StoreLocation.findById(found.appt.storeLocation).lean();
  if (!store) return res.status(404).json({ error: "Store not found" });

  const config = store.pickupConfig ?? DEFAULT_PICKUP_CONFIG;
  const windows = config.windows?.length ? config.windows : DEFAULT_PICKUP_CONFIG.windows;
  if (!windows.some((w) => `${w.start}-${w.end}` === parsed.data.timeSlot)) {
    return res.status(400).json({ error: "That time slot doesn't exist for this store" });
  }

  const dayStart = new Date(`${parsed.data.date}T00:00:00`);
  const dayEnd = new Date(`${parsed.data.date}T23:59:59`);
  const booked = await PickupAppointment.countDocuments({
    _id: { $ne: found.appt._id },
    storeLocation: store._id,
    date: { $gte: dayStart, $lte: dayEnd },
    timeSlot: parsed.data.timeSlot,
    status: { $in: ["BOOKED", "READY"] },
  });
  if (booked >= (config.capacityPerSlot ?? DEFAULT_PICKUP_CONFIG.capacityPerSlot)) {
    return res.status(409).json({ error: "That slot is full — pick another" });
  }

  found.appt.date = new Date(`${parsed.data.date}T00:00:00`);
  found.appt.timeSlot = parsed.data.timeSlot;
  found.appt.status = "BOOKED";
  found.appt.remindersSent = [] as typeof found.appt.remindersSent;
  await found.appt.save();

  res.json({ appointment: found.appt });
});

router.post("/:id/cancel", async (req, res) => {
  const found = await loadOwnAppointment(req.params.id, req.user!.uid);
  if (!found) return res.status(404).json({ error: "Appointment not found" });
  if (!["BOOKED", "READY"].includes(found.appt.status)) {
    return res.status(400).json({ error: "This appointment can no longer be cancelled" });
  }

  found.appt.status = "CANCELLED";
  await found.appt.save();
  res.json({ appointment: found.appt });
});

export default router;
