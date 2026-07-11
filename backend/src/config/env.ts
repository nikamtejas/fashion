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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Fix the environment variables listed above (see backend/.env.example) before starting the server.");
}

export const env = parsed.data;
