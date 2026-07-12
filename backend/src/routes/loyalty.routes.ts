import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getLoyaltyAccount, EARN_RATE_RUPEES_PER_POINT } from "../services/loyalty.service";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const account = await getLoyaltyAccount(req.user!.uid);
  res.json({
    points: account.points,
    earnRate: EARN_RATE_RUPEES_PER_POINT,
    history: [...account.history].reverse().slice(0, 20),
  });
});

export default router;
