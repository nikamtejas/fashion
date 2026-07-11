import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { listAdminOrders, getAdminOrder } from "../controllers/adminOrder.controller.js";

export const adminOrderRouter = Router();

adminOrderRouter.use(requireAuth, requireRole("admin"));

adminOrderRouter.get("/", listAdminOrders);
adminOrderRouter.get("/:id", getAdminOrder);
