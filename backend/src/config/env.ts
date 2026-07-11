import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  COOKIE_NAME: z.string().default("fp_session"),
  COOKIE_DOMAIN: z.string().optional(),
  CORS_ORIGINS: z
    .string()
    .min(1, "CORS_ORIGINS is required (comma-separated list of allowed origins)")
    .transform((val) => val.split(",").map((origin) => origin.trim()).filter(Boolean)),
  ADMIN_SEED_EMAIL: z.string().email().optional(),
  ADMIN_SEED_PASSWORD: z.string().min(8).optional(),
  ADMIN_SEED_NAME: z.string().optional(),

  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),

  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  GEMINI_IMAGE_MODEL_PRIMARY: z.string().default("gemini-3-pro-image-preview"),
  GEMINI_IMAGE_MODEL_FAST: z.string().default("gemini-3.1-flash-image"),

  // Optional: lets the backend tell the storefront to drop its cached catalog pages
  // right after an admin write, instead of waiting for a full rebuild. Degrades
  // gracefully (silently skipped) if unset.
  STOREFRONT_REVALIDATE_URL: z.string().url().optional(),
  REVALIDATE_SECRET: z.string().min(16).optional(),

  // Optional so COD checkout keeps working before Razorpay is set up — the Razorpay
  // routes themselves return a clear 503 if these are missing when actually used.
  // Snapmint EMI needs no separate keys: it's enabled as a checkout option directly
  // on the Razorpay account (SPEC.md §4.4).
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Fix the environment variables listed above (see backend/.env.example) before starting the server.");
}

export const env = parsed.data;
