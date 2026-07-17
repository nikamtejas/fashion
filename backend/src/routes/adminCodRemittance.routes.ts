import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireOps } from "../middleware/auth";
import { Payment } from "../models/Payment";
import { CodRemittance } from "../models/CodRemittance";

const router = Router();
router.use(requireOps);

const round2 = (n: number) => Math.round(n * 100) / 100;
const AGING_DAYS = 7;

/**
 * COD cash the courier is currently holding on our behalf — collected from
 * customers at the door (or handed over at pickup counters) but not yet
 * credited to our bank account. This is the working-capital-at-risk view:
 * anything past AGING_DAYS without a matching remittance is worth chasing.
 */
router.get("/outstanding", async (_req, res) => {
  const payments = await Payment.find({ method: "COD", codRemittanceStatus: "PENDING" })
    .sort({ codCollectedAt: 1 })
    .populate({ path: "order", select: "orderNumber deliveryMethod shippingAddress" })
    .lean();

  const now = Date.now();
  const rows = payments.map((p) => {
    const collectedAt = p.codCollectedAt ?? p.createdAt;
    const daysOutstanding = collectedAt ? Math.floor((now - new Date(collectedAt).getTime()) / 86_400_000) : 0;
    return {
      paymentId: String(p._id),
      order: p.order,
      amount: p.amount,
      codCollectedAt: p.codCollectedAt,
      daysOutstanding,
      overdue: daysOutstanding > AGING_DAYS,
    };
  });

  res.json({
    rows,
    totalOutstanding: round2(rows.reduce((s, r) => s + r.amount, 0)),
    overdueCount: rows.filter((r) => r.overdue).length,
    overdueAmount: round2(rows.filter((r) => r.overdue).reduce((s, r) => s + r.amount, 0)),
  });
});

/** Remittance batch history. */
router.get("/", async (_req, res) => {
  const remittances = await CodRemittance.find()
    .sort({ remittedAt: -1 })
    .limit(200)
    .populate({ path: "payments", select: "amount order", populate: { path: "order", select: "orderNumber" } })
    .lean();
  res.json({ remittances });
});

const createSchema = z.object({
  courier: z.string().trim().min(1).default("Blue Dart (DHL)"),
  reference: z.string().trim().min(1, "Enter the courier's remittance/UTR reference"),
  amount: z.number().positive(),
  courierFee: z.number().min(0).default(0),
  remittedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  paymentIds: z.array(z.string()).min(1, "Select at least one order this batch covers"),
  notes: z.string().max(1000).optional(),
});

/**
 * Logs a remittance batch against the courier's actual report and marks the
 * selected orders settled. `amount` is what they say they credited us —
 * comparing it against the sum of matched orders surfaces shortfalls
 * (a courier under-remitting, or an order missing from the batch) instead
 * of silently trusting their number.
 */
router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid remittance" });

  const ids = parsed.data.paymentIds.filter((id) => mongoose.isValidObjectId(id));
  const eligible = await Payment.find({ _id: { $in: ids }, method: "COD", codRemittanceStatus: "PENDING" }).select(
    "_id amount"
  );
  if (eligible.length === 0) {
    return res.status(400).json({ error: "None of the selected orders are pending remittance" });
  }

  const remittance = await CodRemittance.create({
    courier: parsed.data.courier,
    reference: parsed.data.reference,
    amount: parsed.data.amount,
    courierFee: parsed.data.courierFee,
    remittedAt: new Date(`${parsed.data.remittedAt}T00:00:00`),
    payments: eligible.map((p) => p._id),
    notes: parsed.data.notes,
    recordedBy: req.user!.uid,
  });

  await Payment.updateMany(
    { _id: { $in: eligible.map((p) => p._id) } },
    { $set: { codRemittanceStatus: "REMITTED", codRemittance: remittance._id } }
  );

  const matchedTotal = round2(eligible.reduce((s, p) => s + p.amount, 0));
  const skipped = ids.length - eligible.length;

  res.status(201).json({
    remittance,
    matchedCount: eligible.length,
    matchedTotal,
    skipped,
    varianceFromReported: round2(parsed.data.amount - matchedTotal),
  });
});

export default router;
