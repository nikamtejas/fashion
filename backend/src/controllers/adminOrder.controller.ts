import type { Request, Response } from "express";
import { OrderModel } from "../models/Order.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

// Read-only for now — full order management (status transitions, filters, tracking
// link) is Milestone 8's admin dashboard scope. This exists so M5's "a test order
// can be completed" is actually verifiable from the admin side.
export const listAdminOrders = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const filter: Record<string, unknown> = {};
  if (typeof req.query.status === "string") filter.status = req.query.status;

  const [items, total] = await Promise.all([
    OrderModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate("userId", "name email"),
    OrderModel.countDocuments(filter),
  ]);

  res.json({ items, total, page, pageSize });
});

export const getAdminOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await OrderModel.findById(req.params.id).populate("userId", "name email");
  if (!order) throw new ApiError(404, "Order not found");
  res.json({ order });
});
