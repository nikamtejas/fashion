import { Router } from "express";
import { listPublicProducts, getPublicProduct } from "../controllers/product.controller.js";

export const productRouter = Router();

productRouter.get("/", listPublicProducts);
productRouter.get("/:slug", getPublicProduct);
