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
import favoritesRoutes from "./routes/favorites.routes";
import adminProductsRoutes from "./routes/adminProducts.routes";
import adminPhotoStudioRoutes from "./routes/adminPhotoStudio.routes";
import cartRoutes from "./routes/cart.routes";
import adminCouponsRoutes from "./routes/adminCoupons.routes";
import storesRoutes from "./routes/stores.routes";
import adminStoresRoutes from "./routes/adminStores.routes";
import addressesRoutes from "./routes/addresses.routes";
import paymentsRoutes from "./routes/payments.routes";
import webhooksRoutes from "./routes/webhooks.routes";
import adminSettingsRoutes from "./routes/adminSettings.routes";
import ordersRoutes from "./routes/orders.routes";
import appointmentsRoutes from "./routes/appointments.routes";
import adminPickupsRoutes from "./routes/adminPickups.routes";
import trackRoutes from "./routes/track.routes";
import adminOrdersRoutes from "./routes/adminOrders.routes";
import returnsRoutes from "./routes/returns.routes";
import adminReturnsRoutes from "./routes/adminReturns.routes";
import notificationsRoutes from "./routes/notifications.routes";
import adminInvoicesRoutes from "./routes/adminInvoices.routes";
import adminPosRoutes from "./routes/adminPos.routes";
import adminDashboardRoutes from "./routes/adminDashboard.routes";
import adminCustomersRoutes from "./routes/adminCustomers.routes";
import adminInventoryRoutes from "./routes/adminInventory.routes";
import alertsRoutes from "./routes/alerts.routes";
import loyaltyRoutes from "./routes/loyalty.routes";
import lookbooksRoutes from "./routes/lookbooks.routes";
import adminLookbooksRoutes from "./routes/adminLookbooks.routes";
import stylistRoutes from "./routes/stylist.routes";
import adminReviewsRoutes from "./routes/adminReviews.routes";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.frontendUrl, credentials: true }));
  // Webhooks verify HMAC signatures over the raw body, so they mount
  // before the JSON parser (the router applies express.raw itself).
  app.use("/api/webhooks", webhooksRoutes);
  // Raised limit: admin image uploads arrive as base64 data URIs in JSON.
  app.use(express.json({ limit: "20mb" }));
  app.use(cookieParser());
  app.use(attachUser);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api/categories", categoriesRoutes);
  app.use("/api/products", productsRoutes);
  app.use("/api/search", searchRoutes);
  app.use("/api/newsletter", newsletterRoutes);
  app.use("/api/cloudinary", cloudinaryRoutes);
  app.use("/api/favorites", favoritesRoutes);
  app.use("/api/admin/products", adminProductsRoutes);
  app.use("/api/admin/products", adminPhotoStudioRoutes);
  app.use("/api/cart", cartRoutes);
  app.use("/api/admin/coupons", adminCouponsRoutes);
  app.use("/api/stores", storesRoutes);
  app.use("/api/admin/stores", adminStoresRoutes);
  app.use("/api/addresses", addressesRoutes);
  app.use("/api/payments", paymentsRoutes);
  app.use("/api/admin/settings", adminSettingsRoutes);
  app.use("/api/orders", ordersRoutes);
  app.use("/api/appointments", appointmentsRoutes);
  app.use("/api/admin/pickups", adminPickupsRoutes);
  app.use("/api/track", trackRoutes);
  app.use("/api/admin/orders", adminOrdersRoutes);
  app.use("/api/returns", returnsRoutes);
  app.use("/api/admin/returns", adminReturnsRoutes);
  app.use("/api/notifications", notificationsRoutes);
  app.use("/api/admin/invoices", adminInvoicesRoutes);
  app.use("/api/admin/pos", adminPosRoutes);
  app.use("/api/admin/dashboard", adminDashboardRoutes);
  app.use("/api/admin/customers", adminCustomersRoutes);
  app.use("/api/admin/inventory", adminInventoryRoutes);
  app.use("/api/alerts", alertsRoutes);
  app.use("/api/loyalty", loyaltyRoutes);
  app.use("/api/lookbooks", lookbooksRoutes);
  app.use("/api/admin/lookbooks", adminLookbooksRoutes);
  app.use("/api/stylist", stylistRoutes);
  app.use("/api/admin/reviews", adminReviewsRoutes);

  app.use(errorHandler);

  return app;
}
