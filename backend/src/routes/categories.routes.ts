import { Router } from "express";
import { Category } from "../models/Category";

const router = Router();

router.get("/", async (_req, res) => {
  const categories = await Category.find().sort({ order: 1 }).select("name slug image").lean();
  res.json({ categories });
});

export default router;
