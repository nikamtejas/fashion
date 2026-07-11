import type { Request, Response } from "express";
import { CouponModel } from "../models/Coupon.js";
import { createCouponSchema, updateCouponSchema } from "../validators/coupon.validators.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

export const listCoupons = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

  const [items, total] = await Promise.all([
    CouponModel.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    CouponModel.countDocuments(),
  ]);

  res.json({ items, total, page, pageSize });
});

export const getCoupon = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await CouponModel.findById(req.params.id);
  if (!coupon) throw new ApiError(404, "Coupon not found");
  res.json({ coupon });
});

export const createCoupon = asyncHandler(async (req: Request, res: Response) => {
  const input = createCouponSchema.parse(req.body);
  const code = input.code.toUpperCase();
  const existing = await CouponModel.findOne({ code });
  if (existing) throw new ApiError(409, "A coupon with this code already exists");

  const coupon = await CouponModel.create({ ...input, code });
  res.status(201).json({ coupon });
});

export const updateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const input = updateCouponSchema.parse(req.body);
  const coupon = await CouponModel.findById(req.params.id);
  if (!coupon) throw new ApiError(404, "Coupon not found");

  if (input.code && input.code.toUpperCase() !== coupon.code) {
    const codeTaken = await CouponModel.exists({ code: input.code.toUpperCase(), _id: { $ne: coupon._id } });
    if (codeTaken) throw new ApiError(409, "A coupon with this code already exists");
  }

  Object.assign(coupon, input, input.code ? { code: input.code.toUpperCase() } : {});
  await coupon.save();
  res.json({ coupon });
});

export const deleteCoupon = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await CouponModel.findByIdAndDelete(req.params.id);
  if (!coupon) throw new ApiError(404, "Coupon not found");
  res.status(204).send();
});
