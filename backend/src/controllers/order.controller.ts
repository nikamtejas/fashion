import type { Request, Response } from "express";
import { getOrCreateCart } from "../models/Cart.js";
import { buildCartResponse } from "../services/cart.service.js";
import { createRazorpayOrder, verifyRazorpayPayment, fetchRazorpayPaymentMethod } from "../services/razorpay.service.js";
import { placeOrder } from "../services/order.service.js";
import { OrderModel } from "../models/Order.js";
import { placeOrderSchema, verifyRazorpaySchema } from "../validators/order.validators.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

export const createRazorpayCheckout = asyncHandler(async (req: Request, res: Response) => {
  const cart = await getOrCreateCart(req.session!.sub);
  const cartResponse = await buildCartResponse(cart);
  if (cartResponse.items.length === 0) {
    throw new ApiError(400, "Your cart is empty");
  }

  // Razorpay caps receipt at 40 chars — a full ObjectId + timestamp blows past that,
  // so only the last 6 chars of the user id are kept (still enough to trace by eye).
  const receipt = `rcpt_${Date.now()}_${req.session!.sub.slice(-6)}`;
  const result = await createRazorpayOrder(cartResponse.total, receipt);
  res.status(201).json(result);
});

export const verifyRazorpayCheckout = asyncHandler(async (req: Request, res: Response) => {
  const input = verifyRazorpaySchema.parse(req.body);

  const valid = verifyRazorpayPayment(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature);
  if (!valid) {
    throw new ApiError(400, "Payment verification failed");
  }

  const razorpayMethod = await fetchRazorpayPaymentMethod(input.razorpayPaymentId);

  const order = await placeOrder({
    userId: req.session!.sub,
    paymentMethod: "razorpay",
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: input.razorpayPaymentId,
    razorpayMethod,
    shippingAddress: input.shippingAddress,
    whatsappNumber: input.whatsappNumber,
  });

  res.status(201).json({ order });
});

export const placeCodOrder = asyncHandler(async (req: Request, res: Response) => {
  const input = placeOrderSchema.parse(req.body);

  const order = await placeOrder({
    userId: req.session!.sub,
    paymentMethod: "cod",
    shippingAddress: input.shippingAddress,
    whatsappNumber: input.whatsappNumber,
  });

  res.status(201).json({ order });
});

export const listMyOrders = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

  const [items, total] = await Promise.all([
    OrderModel.find({ userId: req.session!.sub })
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    OrderModel.countDocuments({ userId: req.session!.sub }),
  ]);

  res.json({ items, total, page, pageSize });
});

export const getMyOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await OrderModel.findOne({ _id: req.params.id, userId: req.session!.sub });
  if (!order) throw new ApiError(404, "Order not found");
  res.json({ order });
});
