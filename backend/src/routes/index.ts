import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { productRouter } from "./product.routes.js";
import { adminProductRouter } from "./adminProduct.routes.js";
import { adminImageRouter } from "./adminImage.routes.js";
import { adminSettingsRouter } from "./adminSettings.routes.js";
import { cartRouter } from "./cart.routes.js";
import { favoriteRouter } from "./favorite.routes.js";
import { adminCouponRouter } from "./adminCoupon.routes.js";
import { orderRouter } from "./order.routes.js";
import { adminOrderRouter } from "./adminOrder.routes.js";

export const router = Router();

router.use("/auth", authRouter);
router.use("/products", productRouter);
router.use("/admin/products", adminProductRouter);
router.use("/admin/images", adminImageRouter);
router.use("/admin/settings", adminSettingsRouter);
router.use("/cart", cartRouter);
router.use("/favorites", favoriteRouter);
router.use("/admin/coupons", adminCouponRouter);
router.use("/orders", orderRouter);
router.use("/admin/orders", adminOrderRouter);
