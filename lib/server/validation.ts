import { z } from "zod";

const jsonRecord = z.record(z.string(), z.unknown()).refine((value) => {
  try { return Buffer.byteLength(JSON.stringify(value), "utf8") <= 200_000; } catch { return false; }
}, "Content exceeds the 200 KB limit or is not valid JSON.");

export const loginSchema = z.object({ email: z.string().trim().max(240).email().transform((s) => s.toLowerCase()), password: z.string().min(1).max(256) });
export const passwordChangeSchema = z.object({ currentPassword: z.string().min(1).max(256), newPassword: z.string().min(14).max(256) });
export const contentKindSchema = z.enum(["settings", "pages", "projects", "navigation", "seo"]);
export const contentDraftSchema = z.object({ kind: contentKindSchema, key: z.string().min(1).max(200), draft: jsonRecord });
export const publishSchema = z.object({ kind: contentKindSchema, key: z.string().min(1).max(200) });
export const restoreSchema = z.object({ revisionId: z.string().uuid() });
export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(240),
  company: z.string().trim().max(200).default(""),
  subject: z.string().trim().min(3).max(180),
  message: z.string().trim().min(20).max(5000),
  website: z.string().max(200).optional().default(""),
});
export const leadStatusSchema = z.object({ id: z.string().uuid(), status: z.enum(["new", "reviewing", "qualified", "won", "archived"]) });
export const mediaMetadataSchema = z.object({ altText: z.string().trim().min(3).max(500), focalX: z.coerce.number().min(0).max(1).default(0.5), focalY: z.coerce.number().min(0).max(1).default(0.5) });
export const analyticsStateSchema = z.object({ connected: z.literal(false), provider: z.enum(["ga4", "search-console"]) });

export type ContentKind = z.infer<typeof contentKindSchema>;
