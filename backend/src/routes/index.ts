import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { productRouter } from "./product.routes.js";
import { adminProductRouter } from "./adminProduct.routes.js";
import { adminImageRouter } from "./adminImage.routes.js";
import { adminSettingsRouter } from "./adminSettings.routes.js";

export const router = Router();

router.use("/auth", authRouter);
router.use("/products", productRouter);
router.use("/admin/products", adminProductRouter);
router.use("/admin/images", adminImageRouter);
router.use("/admin/settings", adminSettingsRouter);
