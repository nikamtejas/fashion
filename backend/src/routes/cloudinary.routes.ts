import { Router } from "express";
import { cloudinary } from "../lib/cloudinary";
import { requireCatalog } from "../middleware/auth";
import { env } from "../config/env";

const router = Router();

// Mints a signature for direct-from-browser signed uploads (used by the
// admin product image dropzones from Milestone 2 onward).
router.post("/sign", requireCatalog, (req, res) => {
  const folder = (req.body?.folder as string | undefined) ?? "luxeloom/misc";
  const timestamp = Math.round(Date.now() / 1000);

  const paramsToSign: Record<string, string | number> = { timestamp, folder };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, env.cloudinaryApiSecret as string);

  res.json({
    signature,
    timestamp,
    cloudName: env.cloudinaryCloudName,
    apiKey: env.cloudinaryApiKey,
    folder,
  });
});

export default router;
