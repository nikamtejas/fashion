import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { ApiError } from "../utils/ApiError.js";
import { enhanceImage } from "../controllers/adminImage.controller.js";

export const adminImageRouter = Router();

adminImageRouter.use(requireAuth, requireRole("admin"));

function handleSingleImageUpload(req: Request, res: Response, next: NextFunction) {
  upload.single("image")(req, res, (err: unknown) => {
    if (err) {
      next(new ApiError(400, err instanceof Error ? err.message : "Invalid file upload"));
      return;
    }
    next();
  });
}

adminImageRouter.post("/enhance", handleSingleImageUpload, enhanceImage);
