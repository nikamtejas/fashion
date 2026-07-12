import { Router } from "express";
import { requireAdmin } from "../middleware/auth";
import { Review } from "../models/Review";
import { Product } from "../models/Product";

const router = Router();
router.use(requireAdmin);

router.get("/", async (req, res) => {
  const raw = (req.query.status as string | undefined) ?? "PENDING";
  const status = (["PENDING", "APPROVED", "REJECTED"].includes(raw) ? raw : "PENDING") as
    | "PENDING"
    | "APPROVED"
    | "REJECTED";
  const reviews = await Review.find({ status })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("user", "email name")
    .populate("product", "name slug")
    .lean();
  res.json({ reviews });
});

async function recomputeRating(productId: unknown) {
  const stats = await Review.aggregate([
    { $match: { product: productId, status: "APPROVED" } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne(
    { _id: productId },
    { ratingAvg: Math.round((stats[0]?.avg ?? 0) * 10) / 10, ratingCount: stats[0]?.count ?? 0 }
  );
}

router.post("/:id/approve", async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ error: "Review not found" });
  review.status = "APPROVED";
  await review.save();
  await recomputeRating(review.product);
  res.json({ review });
});

router.post("/:id/reject", async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ error: "Review not found" });
  review.status = "REJECTED";
  await review.save();
  await recomputeRating(review.product);
  res.json({ review });
});

export default router;
