import { Router } from "express";
import { z } from "zod";
import { PickupAppointment } from "../models/PickupAppointment";
import { requireOps } from "../middleware/auth";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { Payment } from "../models/Payment";
import { sendEmail, sendOtpEmail } from "../lib/mailer";
import { findValidOtp, issueOtp } from "../lib/otp";
import { sendDeliveredEmail } from "../services/orderEmails.service";
import { orderSubject } from "../lib/orderSubject";

const router = Router();
router.use(requireOps);

/** Daily pickup agenda, optionally per store. Includes NO_SHOW flags for
 * follow-up. */
router.get("/", async (req, res) => {
  const date = (req.query.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const storeId = req.query.storeId as string | undefined;

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);

  // type: "PICKUP" — the same collection also holds RETURN drop-off
  // appointments (in-store returns), which must never surface in the
  // purchase-pickup agenda or be handed over as if they were one.
  const query: Record<string, unknown> = { type: "PICKUP", date: { $gte: dayStart, $lte: dayEnd } };
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
  if (appt.type !== "PICKUP") return res.status(400).json({ error: "This is a return drop-off, not a pickup" });
  if (appt.status !== "BOOKED") return res.status(400).json({ error: `Can't mark a ${appt.status} appointment ready` });

  appt.status = "READY";
  await appt.save();

  const order = await Order.findById(appt.order).select("orderNumber user items").lean();
  const user = order ? await User.findById(order.user).select("email").lean() : null;
  if (user && order) {
    await sendEmail(
      user.email,
      orderSubject("Ready for pickup", order.orderNumber, order.items),
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

/** Counter scan station: everything the staff member needs to see after
 * scanning any pickup QR — order, items, customer, payment state. */
router.get("/lookup/:qrCode", async (req, res) => {
  const qrCode = req.params.qrCode.toUpperCase().trim();
  // Scoped to type: "PICKUP" — a return drop-off code must not resolve here
  // and get handed over as a purchase pickup (see the /:id/complete guard
  // below for why that would corrupt the order and payment state).
  const appt = await PickupAppointment.findOne({ qrCode, type: "PICKUP" }).populate("storeLocation", "name city").lean();
  if (!appt) return res.status(404).json({ error: "No pickup appointment matches this code" });

  const order = await Order.findById(appt.order)
    .select("orderNumber status items pricing user")
    .populate("user", "name email phone")
    .lean();
  if (!order) return res.status(404).json({ error: "Order for this pickup no longer exists" });
  const payment = await Payment.findOne({ order: order._id }).select("method status").lean();

  const user = order.user as unknown as { name?: string; email?: string; phone?: string } | null;
  res.json({
    appointment: {
      _id: appt._id,
      status: appt.status,
      date: appt.date,
      timeSlot: appt.timeSlot,
      qrCode: appt.qrCode,
      store: appt.storeLocation,
    },
    order: {
      _id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      items: order.items.map((i) => ({ name: i.name, size: i.size, color: i.color, qty: i.qty, price: i.price, image: i.image })),
      total: order.pricing.total,
    },
    customer: { name: user?.name, email: user?.email, phone: user?.phone },
    payment: {
      method: payment?.method ?? "—",
      status: payment?.status ?? "PENDING",
      /** Cash the counter must collect before handover (COD not yet paid). */
      dueAmount: payment?.method === "COD" && payment?.status !== "PAID" ? order.pricing.total : 0,
    },
  });
});

/** Handover OTP: emails the customer a one-time code the staff member can
 * enter instead of the QR (customer can't open the QR, phone died, etc.). */
router.post("/:id/handover-otp", async (req, res) => {
  const appt = await PickupAppointment.findById(req.params.id).lean();
  if (!appt) return res.status(404).json({ error: "Appointment not found" });
  if (appt.type !== "PICKUP") return res.status(400).json({ error: "This is a return drop-off, not a pickup" });
  if (!["BOOKED", "READY"].includes(appt.status)) {
    return res.status(400).json({ error: `This appointment is ${appt.status}` });
  }
  const order = await Order.findById(appt.order).select("user").lean();
  const user = order ? await User.findById(order.user).select("email").lean() : null;
  if (!user) return res.status(404).json({ error: "Customer account not found for this order" });

  const code = await issueOtp(`pickup:${appt.qrCode}`);
  await sendOtpEmail(user.email, code);
  res.json({ ok: true, sentTo: user.email });
});

const completeSchema = z
  .object({ qrCode: z.string().min(4).optional(), otp: z.string().min(4).optional() })
  .refine((d) => d.qrCode || d.otp, { message: "Provide the QR code or the handover OTP" });

/** Handover: verified by the scanned QR code OR the emailed handover OTP.
 * Marks the appointment complete, collects COD cash, sets the order
 * DELIVERED and sends the delivered email with the GST invoice. */
router.post("/:id/complete", async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter the pickup code or OTP" });

  const appt = await PickupAppointment.findById(req.params.id);
  if (!appt) return res.status(404).json({ error: "Appointment not found" });
  if (appt.type !== "PICKUP") return res.status(400).json({ error: "This is a return drop-off, not a pickup" });
  if (!["BOOKED", "READY"].includes(appt.status)) {
    return res.status(400).json({ error: `This appointment is ${appt.status}` });
  }

  if (parsed.data.qrCode) {
    if (appt.qrCode !== parsed.data.qrCode.toUpperCase().trim()) {
      return res.status(400).json({ error: "Pickup code doesn't match" });
    }
  } else {
    const token = await findValidOtp(`pickup:${appt.qrCode}`, parsed.data.otp!.trim());
    if (!token) return res.status(401).json({ error: "Incorrect or expired handover OTP" });
    token.consumedAt = new Date();
    await token.save();
  }

  appt.status = "COMPLETED";
  await appt.save();

  // COD pickups pay cash at the counter — handover is the payment moment.
  await Payment.updateOne({ order: appt.order, method: "COD", status: "PENDING" }, { $set: { status: "PAID" } });

  await Order.updateOne({ _id: appt.order }, { status: "DELIVERED" });
  sendDeliveredEmail(String(appt.order)).catch((e) => console.error("delivered email failed:", e));

  res.json({ appointment: appt });
});

export default router;
