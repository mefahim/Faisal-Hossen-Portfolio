import "server-only";
import { z } from "zod";

const optionalUrl = z.string().url().optional();
const schema = z.object({
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//).optional(),
  DATABASE_SSL: z.enum(["true", "false"]).default("false"),
  MEDIA_STORAGE_DIR: z.string().min(1).default("./var/media"),
  CONTENT_SOURCE: z.enum(["files", "database"]).default("files"),
  APP_SECURITY_SECRET: z.string().min(32).optional(),
  BOOTSTRAP_OWNER_EMAIL: z.string().email().optional(),
  BOOTSTRAP_OWNER_PASSWORD: z.string().min(14).max(256).optional(),
  NEXT_PUBLIC_SITE_URL: optionalUrl,
  RESEND_API_KEY: z.string().optional(),
  CONTACT_EMAIL: z.string().email().optional(),
  CONTACT_FROM_EMAIL: z.string().optional(),
});

export type AppConfig = z.infer<typeof schema>;
let cached: AppConfig | undefined;
export function getConfig(): AppConfig {
  cached ??= schema.parse(process.env);
  return cached;
}
export function assertDatabaseConfigured(): AppConfig & { DATABASE_URL: string } {
  const config = getConfig();
  if (!config.DATABASE_URL) throw new Error("Database is not configured. Set DATABASE_URL before using Faisal’s Room or durable contact storage.");
  return config as AppConfig & { DATABASE_URL: string };
}
export function assertSecuritySecret(): string {
  const secret = getConfig().APP_SECURITY_SECRET;
  if (!secret || secret.length < 32) throw new Error("APP_SECURITY_SECRET must contain at least 32 characters.");
  return secret;
}
