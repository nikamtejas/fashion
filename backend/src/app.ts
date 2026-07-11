import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { attachUser } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";

import authRoutes from "./routes/auth.routes";
import categoriesRoutes from "./routes/categories.routes";
import productsRoutes from "./routes/products.routes";
import searchRoutes from "./routes/search.routes";
import newsletterRoutes from "./routes/newsletter.routes";
import cloudinaryRoutes from "./routes/cloudinary.routes";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.frontendUrl, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(attachUser);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api/categories", categoriesRoutes);
  app.use("/api/products", productsRoutes);
  app.use("/api/search", searchRoutes);
  app.use("/api/newsletter", newsletterRoutes);
  app.use("/api/cloudinary", cloudinaryRoutes);

  app.use(errorHandler);

  return app;
}
