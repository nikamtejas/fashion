import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  applyCoupon,
  removeCoupon,
} from "../controllers/cart.controller.js";

export const cartRouter = Router();

cartRouter.use(requireAuth);

cartRouter.get("/", getCart);
cartRouter.post("/items", addCartItem);
cartRouter.patch("/items/:itemId", updateCartItem);
cartRouter.delete("/items/:itemId", removeCartItem);
cartRouter.post("/coupon", applyCoupon);
cartRouter.delete("/coupon", removeCoupon);
