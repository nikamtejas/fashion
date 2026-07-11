import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createRazorpayCheckout,
  verifyRazorpayCheckout,
  placeCodOrder,
  listMyOrders,
  getMyOrder,
} from "../controllers/order.controller.js";

export const orderRouter = Router();

orderRouter.use(requireAuth);

orderRouter.post("/razorpay/create", createRazorpayCheckout);
orderRouter.post("/razorpay/verify", verifyRazorpayCheckout);
orderRouter.post("/cod", placeCodOrder);
orderRouter.get("/", listMyOrders);
orderRouter.get("/:id", getMyOrder);
