import "dotenv/config";
import { z } from "zod";

const bool = (fallback: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === "true" || v === "1"));

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  CLIENT_URL: z.string().default("http://localhost:3000"),
  API_PUBLIC_URL: z.string().default("http://localhost:5000"),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  COOKIE_SECURE: bool(false),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),

  GEMINI_API_KEY: optional,
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  GROQ_API_KEY: optional,
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),
  GROQ_VISION_MODEL: optional,

  CLOUDINARY_CLOUD_NAME: optional,
  CLOUDINARY_API_KEY: optional,
  CLOUDINARY_API_SECRET: optional,

  REDIS_URL: optional,

  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: optional,
  SMTP_PASS: optional,
  MAIL_FROM: z.string().default("SmartMed <no-reply@smartmed.app>"),

  VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,
  VAPID_SUBJECT: z.string().default("mailto:support@smartmed.app"),

  // Offline alerts. "log" just prints – handy in development.
  SMS_PROVIDER: z.enum(["log", "bulksmsbd", "twilio"]).default("log"),
  VOICE_PROVIDER: z.enum(["log", "twilio"]).default("log"),
  BULKSMSBD_API_KEY: optional,
  BULKSMSBD_SENDER_ID: optional,
  TWILIO_ACCOUNT_SID: optional,
  TWILIO_AUTH_TOKEN: optional,
  TWILIO_FROM_NUMBER: optional,

  SSLC_STORE_ID: optional,
  SSLC_STORE_PASSWORD: optional,
  SSLC_IS_LIVE: bool(false),
  PREMIUM_PRICE_BDT: z.coerce.number().default(199),

  FREE_AI_SCANS_PER_MONTH: z.coerce.number().default(5),
  MISSED_DOSE_GRACE_MINUTES: z.coerce.number().default(30),
  ENABLE_JOBS: bool(true),
  /** Shared secret for GET /api/jobs/tick (serverless hosting such as Vercel + an external cron). */
  CRON_SECRET: optional.refine((v) => v === undefined || v.length >= 16, "CRON_SECRET must be at least 16 characters"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`   • ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";

export const features = {
  gemini: Boolean(env.GEMINI_API_KEY),
  groq: Boolean(env.GROQ_API_KEY),
  cloudinary: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
  redis: Boolean(env.REDIS_URL),
  smtp: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
  webPush: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
  sms:
    (env.SMS_PROVIDER === "bulksmsbd" && Boolean(env.BULKSMSBD_API_KEY && env.BULKSMSBD_SENDER_ID)) ||
    (env.SMS_PROVIDER === "twilio" && Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER)),
  voice: env.VOICE_PROVIDER === "twilio" && Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER),
  sslcommerz: Boolean(env.SSLC_STORE_ID && env.SSLC_STORE_PASSWORD),
};
