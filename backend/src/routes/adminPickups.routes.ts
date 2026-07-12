import { Router } from "express";
import { z } from "zod";
import { PickupAppointment } from "../models/PickupAppointment";
import { requireAdmin } from "../middleware/auth";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { sendEmail } from "../lib/mailer";

const router = Router();
router.use(requireAdmin);

/** Daily pickup agenda, optionally per store. Includes NO_SHOW flags for
 * follow-up. */
router.get("/", async (req, res) => {
  const date = (req.query.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const storeId = req.query.storeId as string | undefined;

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);

  const query: Record<string, unknown> = { date: { $gte: dayStart, $lte: dayEnd } };
  if (storeId) query.storeLocation = storeId;

  const appointments = await PickupAppointment.find(query)
    .populate("storeLocation", "name city")
    .populate({ path: "order", select: "orderNumber user items pricing.total", populate: { path: "user", select: "name email" } })
    .sort({ timeSlot: 1 })
    .lean();

  res.json({ date, appointments });
});

router.post("/:id/ready", async (req, res) => {
  const appt = await PickupAppointment.findById(req.params.id);
  if (!appt) return res.status(404).json({ error: "Appointment not found" });
  if (appt.status !== "BOOKED") return res.status(400).json({ error: `Can't mark a ${appt.status} appointment ready` });

  appt.status = "READY";
  await appt.save();

  const order = await Order.findById(appt.order).select("orderNumber user").lean();
  const user = order ? await User.findById(order.user).select("email").lean() : null;
  if (user && order) {
    await sendEmail(
      user.email,
      `Your LuxeLoom order ${order.orderNumber} is ready for pickup`,
      [
        `Great news — your order is packed, quality-checked and waiting for you.`,
        ``,
        `Show this pickup code at the counter: ${appt.qrCode}`,
        `(You'll also find it as a QR code on your order page.)`,
        ``,
        `We look forward to seeing you!`,
      ].join("\n"),
      { heading: "Your order is ready" }
    );
  }

  res.json({ appointment: appt });
});

const completeSchema = z.object({ qrCode: z.string().min(4) });

/** "Scan" = the staff member enters/scans the customer's QR code; it must
 * match this appointment's code. */
router.post("/:id/complete", async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter the pickup code" });

  const appt = await PickupAppointment.findById(req.params.id);
  if (!appt) return res.status(404).json({ error: "Appointment not found" });
  if (!["BOOKED", "READY"].includes(appt.status)) {
    return res.status(400).json({ error: `This appointment is ${appt.status}` });
  }
  if (appt.qrCode !== parsed.data.qrCode.toUpperCase().trim()) {
    return res.status(400).json({ error: "Pickup code doesn't match" });
  }

  appt.status = "COMPLETED";
  await appt.save();
  await Order.updateOne({ _id: appt.order }, { status: "DELIVERED" });

  res.json({ appointment: appt });
});

export default router;
