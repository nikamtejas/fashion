function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",

  mongodbUri: process.env.MONGODB_URI,

  jwtSecret: process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-me",
  cookieName: "ll_session",

  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ?? `http://localhost:${process.env.PORT ?? 4000}/api/auth/google/callback`,

  emailServerHost: process.env.EMAIL_SERVER_HOST,
  emailServerPort: Number(process.env.EMAIL_SERVER_PORT ?? 587),
  emailServerUser: process.env.EMAIL_SERVER_USER,
  emailServerPassword: process.env.EMAIL_SERVER_PASSWORD,
  emailFrom: process.env.EMAIL_FROM ?? "LuxeLoom <no-reply@luxeloom.example>",

  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,

  integrationsMock: process.env.INTEGRATIONS_MOCK !== "false",

  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiImageModelPrimary: process.env.GEMINI_IMAGE_MODEL_PRIMARY ?? "gemini-3-pro-image-preview",
  geminiImageModelFast: process.env.GEMINI_IMAGE_MODEL_FAST ?? "gemini-3.1-flash-image",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  snapmintMerchantId: process.env.SNAPMINT_MERCHANT_ID,
  snapmintApiKey: process.env.SNAPMINT_API_KEY,
  bluedartLicenseKey: process.env.BLUEDART_LICENSE_KEY,
  bluedartLoginId: process.env.BLUEDART_LOGIN_ID,
};

export { required };
