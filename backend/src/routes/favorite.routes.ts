import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listFavorites, addFavorite, removeFavorite } from "../controllers/favorite.controller.js";

export const favoriteRouter = Router();

favoriteRouter.use(requireAuth);

favoriteRouter.get("/", listFavorites);
favoriteRouter.post("/", addFavorite);
favoriteRouter.delete("/:productId", removeFavorite);
