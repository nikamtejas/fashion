import { Router } from "express";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { SupportTicket } from "../models/SupportTicket";
import { Order } from "../models/Order";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const CATEGORIES = ["ORDER", "REFUND", "PAYMENT", "PRODUCT", "OTHER"] as const;

router.get("/", async (req, res) => {
  const tickets = await SupportTicket.find({ user: req.user!.uid })
    .sort({ lastMessageAt: -1 })
    .select("subject category status lastMessageAt createdAt messages")
    .lean();
  res.json({
    tickets: tickets.map((t) => ({
      _id: t._id,
      subject: t.subject,
      category: t.category,
      status: t.status,
      lastMessageAt: t.lastMessageAt,
      createdAt: t.createdAt,
      messageCount: t.messages.length,
      lastMessage: t.messages[t.messages.length - 1] ?? null,
    })),
  });
});

router.post("/", async (req, res) => {
  const parsed = z
    .object({
      subject: z.string().trim().min(3, "Give your question a short subject").max(120),
      category: z.enum(CATEGORIES).default("OTHER"),
      orderId: z.string().optional(),
      message: z.string().trim().min(2, "Describe your question").max(4000),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  let order = null;
  if (parsed.data.orderId) {
    if (!isValidObjectId(parsed.data.orderId)) return res.status(400).json({ error: "Invalid order" });
    order = await Order.findOne({ _id: parsed.data.orderId, user: req.user!.uid }).select("_id");
    if (!order) return res.status(404).json({ error: "Order not found" });
  }

  const ticket = await SupportTicket.create({
    user: req.user!.uid,
    subject: parsed.data.subject,
    category: parsed.data.category,
    order: order?._id,
    messages: [{ sender: "CUSTOMER", body: parsed.data.message }],
    lastMessageAt: new Date(),
  });

  res.status(201).json({ ticket });
});

router.get("/:id", async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: "Ticket not found" });
  const ticket = await SupportTicket.findOne({ _id: req.params.id, user: req.user!.uid })
    .populate("order", "orderNumber")
    .lean();
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  res.json({ ticket });
});

router.post("/:id/messages", async (req, res) => {
  const parsed = z.object({ message: z.string().trim().min(1).max(4000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Write a message first" });
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: "Ticket not found" });

  const ticket = await SupportTicket.findOne({ _id: req.params.id, user: req.user!.uid });
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  ticket.messages.push({ sender: "CUSTOMER", body: parsed.data.message } as (typeof ticket.messages)[number]);
  ticket.lastMessageAt = new Date();
  // A new customer message reopens a resolved thread.
  if (ticket.status === "RESOLVED") ticket.status = "OPEN";
  await ticket.save();

  res.status(201).json({ ticket });
});

export default router;
