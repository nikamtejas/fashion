function required(name: string, fallback?: string): string {
  const value = optional(process.env[name]) ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** .env templates ship keys as `KEY=` — an EMPTY string, not undefined —
 * which would silently defeat every `?? fallback`. Blank means unset. */
function optional(value: string | undefined): string | undefined {
  return value && value.trim() !== "" ? value : undefined;
}

/** FRONTEND_URL may list several origins (comma-separated) so the API accepts
 * both localhost and LAN access (phone testing). All entries feed CORS; the
 * first is the canonical URL used in emails and OAuth redirects. */
const frontendOrigins = (optional(process.env.FRONTEND_URL) ?? "http://localhost:3000")
  .split(",")
  .map((url) => url.trim().replace(/\/+$/, ""))
  .filter(Boolean);

export const env = {
  nodeEnv: optional(process.env.NODE_ENV) ?? "development",
  port: Number(optional(process.env.PORT) ?? 4000),
  frontendUrl: frontendOrigins[0],
  frontendOrigins,

  mongodbUri: optional(process.env.MONGODB_URI),

  jwtSecret: optional(process.env.JWT_SECRET) ?? "dev-only-insecure-secret-change-me",
  cookieName: "ll_session",

  // Guards the one-time POST /api/auth/admin/setup bootstrap; unset = disabled.
  adminSetupKey: optional(process.env.ADMIN_SETUP_KEY),

  googleClientId: optional(process.env.GOOGLE_CLIENT_ID),
  googleClientSecret: optional(process.env.GOOGLE_CLIENT_SECRET),
  googleRedirectUri:
    optional(process.env.GOOGLE_REDIRECT_URI) ??
    `http://localhost:${optional(process.env.PORT) ?? 4000}/api/auth/google/callback`,

  emailServerHost: optional(process.env.EMAIL_SERVER_HOST),
  emailServerPort: Number(optional(process.env.EMAIL_SERVER_PORT) ?? 587),
  emailServerUser: optional(process.env.EMAIL_SERVER_USER),
  emailServerPassword: optional(process.env.EMAIL_SERVER_PASSWORD),
  emailFrom: optional(process.env.EMAIL_FROM) ?? "LuxeLoom <no-reply@luxeloom.example>",

  cloudinaryCloudName: optional(process.env.CLOUDINARY_CLOUD_NAME),
  cloudinaryApiKey: optional(process.env.CLOUDINARY_API_KEY),
  cloudinaryApiSecret: optional(process.env.CLOUDINARY_API_SECRET),

  integrationsMock: process.env.INTEGRATIONS_MOCK !== "false",

  geminiApiKey: optional(process.env.GEMINI_API_KEY),
  geminiImageModelPrimary: optional(process.env.GEMINI_IMAGE_MODEL_PRIMARY) ?? "gemini-3-pro-image-preview",
  geminiImageModelFast: optional(process.env.GEMINI_IMAGE_MODEL_FAST) ?? "gemini-3.1-flash-image",
  razorpayKeyId: optional(process.env.RAZORPAY_KEY_ID),
  razorpayKeySecret: optional(process.env.RAZORPAY_KEY_SECRET),
  razorpayWebhookSecret: optional(process.env.RAZORPAY_WEBHOOK_SECRET),
  snapmintMerchantId: optional(process.env.SNAPMINT_MERCHANT_ID),
  snapmintApiKey: optional(process.env.SNAPMINT_API_KEY),
  bluedartLicenseKey: optional(process.env.BLUEDART_LICENSE_KEY),
  bluedartLoginId: optional(process.env.BLUEDART_LOGIN_ID),

  twilioAccountSid: optional(process.env.TWILIO_ACCOUNT_SID),
  twilioAuthToken: optional(process.env.TWILIO_AUTH_TOKEN),
  twilioFrom: optional(process.env.TWILIO_FROM),
};

export { required };
