import { Router } from "express";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { SupportTicket } from "../models/SupportTicket";
import { requireAdmin } from "../middleware/auth";

const router = Router();
router.use(requireAdmin);

router.get("/", async (req, res) => {
  const status = req.query.status === "RESOLVED" ? "RESOLVED" : req.query.status === "OPEN" ? "OPEN" : undefined;
  const tickets = await SupportTicket.find(status ? { status } : {})
    .sort({ lastMessageAt: -1 })
    .limit(200)
    .populate("user", "name email")
    .populate("order", "orderNumber")
    .lean();
  res.json({ tickets });
});

router.get("/:id", async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: "Ticket not found" });
  const ticket = await SupportTicket.findById(req.params.id)
    .populate("user", "name email phone")
    .populate("order", "orderNumber")
    .lean();
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  res.json({ ticket });
});

router.post("/:id/reply", async (req, res) => {
  const parsed = z.object({ message: z.string().trim().min(1).max(4000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Write a reply first" });
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: "Ticket not found" });

  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  ticket.messages.push({ sender: "SUPPORT", body: parsed.data.message } as (typeof ticket.messages)[number]);
  ticket.lastMessageAt = new Date();
  await ticket.save();

  res.status(201).json({ ticket });
});

router.patch("/:id/status", async (req, res) => {
  const parsed = z.object({ status: z.enum(["OPEN", "RESOLVED"]) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid status" });
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: "Ticket not found" });

  const ticket = await SupportTicket.findByIdAndUpdate(
    req.params.id,
    { $set: { status: parsed.data.status } },
    { new: true }
  );
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  res.json({ ticket });
});

export default router;
