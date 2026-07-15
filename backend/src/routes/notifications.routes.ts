import { Router } from "express";
import { Notification } from "../models/Notification";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  // Polled frequently by the navbar bell — the two queries are independent,
  // so run them concurrently instead of one network round trip at a time.
  const [notifications, unread] = await Promise.all([
    Notification.find({ user: req.user!.uid }).sort({ createdAt: -1 }).limit(30).lean(),
    Notification.countDocuments({ user: req.user!.uid, read: false }),
  ]);
  res.json({ notifications, unread });
});

router.post("/:id/read", async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user!.uid }, { read: true });
  res.json({ ok: true });
});

router.post("/read-all", async (req, res) => {
  await Notification.updateMany({ user: req.user!.uid, read: false }, { read: true });
  res.json({ ok: true });
});

export default router;
