import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  listCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from "../controllers/adminCoupon.controller.js";

export const adminCouponRouter = Router();

adminCouponRouter.use(requireAuth, requireRole("admin"));

adminCouponRouter.get("/", listCoupons);
adminCouponRouter.get("/:id", getCoupon);
adminCouponRouter.post("/", createCoupon);
adminCouponRouter.patch("/:id", updateCoupon);
adminCouponRouter.delete("/:id", deleteCoupon);
