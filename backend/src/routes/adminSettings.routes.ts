import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getSettingsHandler, updateSettingsHandler } from "../controllers/adminSettings.controller.js";

export const adminSettingsRouter = Router();

adminSettingsRouter.use(requireAuth, requireRole("admin"));

adminSettingsRouter.get("/", getSettingsHandler);
adminSettingsRouter.patch("/", updateSettingsHandler);
