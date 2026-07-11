import type { Request, Response } from "express";
import { getSettings } from "../models/Settings.js";
import { updateSettingsSchema } from "../validators/settings.validators.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getSettingsHandler = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await getSettings();
  res.json({ settings });
});

export const updateSettingsHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = updateSettingsSchema.parse(req.body);
  const settings = await getSettings();
  Object.assign(settings, input);
  await settings.save();
  res.json({ settings });
});
