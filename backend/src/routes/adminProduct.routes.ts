import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/adminProduct.controller.js";

export const adminProductRouter = Router();

adminProductRouter.use(requireAuth, requireRole("admin"));

adminProductRouter.get("/", listProducts);
adminProductRouter.get("/:id", getProduct);
adminProductRouter.post("/", createProduct);
adminProductRouter.patch("/:id", updateProduct);
adminProductRouter.delete("/:id", deleteProduct);
