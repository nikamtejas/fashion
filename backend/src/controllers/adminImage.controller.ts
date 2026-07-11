import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadImageBuffer } from "../services/cloudinary.service.js";
import { editProductImage } from "../services/geminiImage.service.js";
import { enhanceImageBodySchema } from "../validators/product.validators.js";

export const enhanceImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ApiError(400, "No image file uploaded (field name: image)");
  }
  const { tier, promptOverride } = enhanceImageBodySchema.parse(req.body);

  const original = await uploadImageBuffer(
    req.file.buffer,
    req.file.mimetype,
    "fashion/products/original"
  );

  // Gemini can fail for reasons outside our control (quota, transient errors,
  // content policy). The admin must still be able to fall back to the original
  // photo per the milestone's "accept / re-run / keep original" requirement, so a
  // failed enhancement is not a hard error — we return the original with a null
  // `enhanced` and an explanation instead of a 502.
  try {
    const edited = await editProductImage({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      tier,
      promptOverride,
    });
    const enhanced = await uploadImageBuffer(edited.buffer, edited.mimeType, "fashion/products/enhanced");

    res.status(201).json({
      original: { publicId: original.publicId, url: original.url },
      enhanced: { publicId: enhanced.publicId, url: enhanced.url, model: edited.model },
    });
  } catch (err) {
    res.status(201).json({
      original: { publicId: original.publicId, url: original.url },
      enhanced: null,
      enhanceError: err instanceof ApiError ? err.message : "Enhancement failed",
    });
  }
});
