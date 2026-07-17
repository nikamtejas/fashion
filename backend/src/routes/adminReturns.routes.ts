import { Router } from "express";
import { z } from "zod";
import { requireOps } from "../middleware/auth";
import { RefundRequest } from "../models/RefundRequest";
import { approveReturn, rejectReturn, storeQc, processRefund } from "../services/returns.service";
import { HttpError } from "../services/order.service";

const router = Router();
router.use(requireOps);

router.get("/", async (req, res) => {
  const status = req.query.status as string | undefined;
  const query: Record<string, unknown> = {};
  if (status) query.status = status;

  const returns = await RefundRequest.find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate({ path: "order", select: "orderNumber user items pricing.total", populate: { path: "user", select: "email name" } })
    .populate("storeLocation", "name city")
    .populate("appointment", "date timeSlot status")
    .lean();

  res.json({ returns });
});

router.post("/:id/approve", async (req, res) => {
  try {
    res.json({ refund: await approveReturn(req.params.id) });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

const rejectSchema = z.object({ reason: z.string().min(3) });

router.post("/:id/reject", async (req, res) => {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Give the customer a reason" });
  try {
    res.json({ refund: await rejectReturn(req.params.id, parsed.data.reason) });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

const qcSchema = z.object({ qrCode: z.string().min(4), pass: z.boolean(), notes: z.string().optional() });

/** Store staff: scan the return QR, inspect, approve/reject on the spot. */
router.post("/:id/qc", async (req, res) => {
  const parsed = qcSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Scan the return code and pick pass/fail" });
  try {
    res.json({ refund: await storeQc(req.params.id, parsed.data) });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

/** Manual refund trigger — the COD bank-payout path. */
router.post("/:id/refund", async (req, res) => {
  try {
    res.json({ refund: await processRefund(req.params.id) });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

export default router;
