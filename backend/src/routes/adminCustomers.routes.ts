import { Router } from "express";
import { requireOps } from "../middleware/auth";
import { User } from "../models/User";
import { Order } from "../models/Order";

const router = Router();
router.use(requireOps);

/** Customer list with lifetime value. */
router.get("/", async (_req, res) => {
  const ltv = await Order.aggregate([
    { $match: { status: { $nin: ["PENDING_PAYMENT", "CANCELLED"] } } },
    {
      $group: {
        _id: "$user",
        lifetimeValue: { $sum: "$pricing.total" },
        orderCount: { $sum: 1 },
        lastOrderAt: { $max: "$createdAt" },
      },
    },
  ]);
  const byUser = new Map(ltv.map((l) => [String(l._id), l]));

  const users = await User.find({ role: "CUSTOMER" }).select("name email createdAt").sort({ createdAt: -1 }).limit(200).lean();

  res.json({
    customers: users.map((u) => {
      const stats = byUser.get(String(u._id));
      return {
        id: String(u._id),
        name: u.name,
        email: u.email,
        joinedAt: u.createdAt,
        lifetimeValue: Math.round(((stats?.lifetimeValue as number) ?? 0) * 100) / 100,
        orderCount: (stats?.orderCount as number) ?? 0,
        lastOrderAt: stats?.lastOrderAt ?? null,
      };
    }),
  });
});

export default router;
