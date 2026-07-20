import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { Order } from "../models/Order";
import { getLoyaltyAccount, EARN_RATE_RUPEES_PER_POINT } from "../services/loyalty.service";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const account = await getLoyaltyAccount(req.user!.uid);
  const history = [...account.history].reverse().slice(0, 20);

  // The ledger only stores an order ObjectId — resolve it to what a
  // customer can actually recognize (what they bought, plus the order
  // number as a secondary reference) in one batched query.
  const orderIds = [...new Set(history.filter((h) => h.order).map((h) => String(h.order)))];
  const orders =
    orderIds.length > 0 ? await Order.find({ _id: { $in: orderIds } }).select("orderNumber items.name").lean() : [];
  const orderById = new Map(orders.map((o) => [String(o._id), o]));

  res.json({
    points: account.points,
    earnRate: EARN_RATE_RUPEES_PER_POINT,
    history: history.map((h) => {
      const order = h.order ? orderById.get(String(h.order)) : undefined;
      const extraItems = (order?.items.length ?? 0) - 1;
      return {
        type: h.type,
        points: h.points,
        date: h.date,
        orderNumber: order?.orderNumber,
        productName: order?.items[0]?.name,
        extraItemCount: extraItems > 0 ? extraItems : undefined,
      };
    }),
  });
});

export default router;
