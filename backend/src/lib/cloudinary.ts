import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

export interface CloudinaryUploadResult {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
}

/**
 * Signed server-side upload. Accepts a base64 data URI or a remote/local
 * file path — anything the Cloudinary SDK's `upload` accepts.
 */
export async function uploadImage(
  source: string,
  opts: { folder: string; publicId?: string }
): Promise<CloudinaryUploadResult> {
  const result = await cloudinary.uploader.upload(source, {
    folder: opts.folder,
    public_id: opts.publicId,
    overwrite: true,
    resource_type: "image",
  });

  return {
    publicId: result.public_id,
    secureUrl: result.secure_url,
    width: result.width,
    height: result.height,
  };
}

/**
 * Builds a responsive, auto-optimized delivery URL for a stored asset.
 * Always route product imagery through this instead of raw secure_url.
 */
export function cloudinaryUrl(publicId: string, width?: number) {
  return cloudinary.url(publicId, {
    secure: true,
    fetch_format: "auto",
    quality: "auto",
    ...(width ? { width, crop: "scale" } : {}),
  });
}

export function productFolder(productSlug: string) {
  return `luxeloom/products/${productSlug}`;
}
