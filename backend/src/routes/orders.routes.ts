import { Router } from "express";
import { Order } from "../models/Order";
import { PickupAppointment } from "../models/PickupAppointment";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const orders = await Order.find({ user: req.user!.uid })
    .sort({ createdAt: -1 })
    .populate("storeLocation", "name city")
    .lean();
  res.json({ orders });
});

router.get("/:id", async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user!.uid })
    .populate("storeLocation", "name address city state pincode phone lat lng")
    .populate("coupon", "code")
    .lean();
  if (!order) return res.status(404).json({ error: "Order not found" });

  const appointment =
    order.deliveryMethod === "PICKUP"
      ? await PickupAppointment.findOne({ order: order._id }).lean()
      : null;

  res.json({ order, appointment });
});

export default router;
