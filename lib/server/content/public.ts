import "server-only";
import { projects as fileProjects } from "@/content/projects";
import { capabilities, contactDetails, problemStates, site, thinkingPrinciples } from "@/content/site";
import { getConfig } from "../config";
import { query } from "../db";
import { pageSchema, projectSchema, seoSchema, settingsSchema } from "./repository";

export const fileSettings = { site, contactDetails, problemStates, thinkingPrinciples, capabilities };
export type PublicSettings = typeof fileSettings;
type CmsPage = { key: string; route: string; title: string; sections: { key: string; type: string; position: number; content: Record<string, unknown> }[] };
function databaseMode() { try { const config = getConfig(); return config.CONTENT_SOURCE === "database" && Boolean(config.DATABASE_URL); } catch { console.error("Published content source configuration is invalid; verified file content remains active."); return false; } }
function warnFallback(type: string) { console.error(`Published ${type} failed completeness or schema checks; verified file content remains active.`); }
export async function getPublishedSettings(): Promise<PublicSettings> {
  if (!databaseMode()) return fileSettings;
  let row: { published: unknown } | undefined;
  try { row = (await query<{ published: unknown }>("SELECT published FROM site_settings WHERE id='default' AND status='published'")).rows[0]; }
  catch { console.error("Site settings database read failed; verified file content remains active."); return fileSettings; }
  if (!row?.published) return fileSettings;
  const parsed = settingsSchema.safeParse(row.published);
  if (!parsed.success) { warnFallback("site settings"); return fileSettings; }
  return parsed.data as PublicSettings;
}
export async function getPublishedProjects() {
  if (!databaseMode()) return fileProjects;
  let rows: { slug: string; published: unknown }[];
  try { rows = (await query<{ slug: string; published: unknown }>("SELECT slug,published FROM projects WHERE status='published' ORDER BY position,slug")).rows; }
  catch { console.error("Project database read failed; verified file content remains active."); return fileProjects; }
  const requiredSlugs = fileProjects.map((project) => project.slug);
  const bySlug = new Map(rows.map((row) => [row.slug, row.published]));
  if (!requiredSlugs.every((slug) => bySlug.has(slug))) return fileProjects;
  const parsed = rows.map((row) => projectSchema.safeParse(row.published));
  if (parsed.some((result) => !result.success)) { warnFallback("projects"); return fileProjects; }
  return parsed.map((result) => {
    const project = result.data!;
    return project.image.startsWith("media:") ? { ...project, image: `/api/media/${project.image.slice("media:".length)}` } : project;
  });
}
export async function getPublishedProject(slug: string) { return (await getPublishedProjects()).find((project) => project.slug === slug); }
export async function getPublishedPage(route: string): Promise<CmsPage | null> {
  if (!databaseMode()) return null;
  let row: { published: unknown } | undefined;
  try { row = (await query<{ published: unknown }>("SELECT published FROM pages WHERE route=$1 AND status='published'", [route])).rows[0]; }
  catch { console.error(`Published page read failed for ${route}; checked-in page content remains active.`); return null; }
  if (!row?.published) return null;
  const parsed = pageSchema.safeParse(row.published);
  if (!parsed.success) { warnFallback(`page ${route}`); return null; }
  return parsed.data as CmsPage;
}
export function getSection(page: CmsPage | null, key: string) { return page?.sections.find((section) => section.key === key)?.content ?? {}; }
export async function getPublishedSeo(route: string) {
  if (!databaseMode()) return null;
  let row: { published: unknown } | undefined;
  try { row = (await query<{ published: unknown }>("SELECT published FROM seo_metadata WHERE route=$1 AND status='published'", [route])).rows[0]; }
  catch { console.error(`Published SEO read failed for ${route}; checked-in metadata remains active.`); return null; }
  if (!row?.published) return null;
  const parsed = seoSchema.safeParse(row.published);
  if (!parsed.success) { warnFallback(`SEO metadata ${route}`); return null; }
  return parsed.data;
}
export async function getPublishedProjectDates(): Promise<Map<string, Date>> {
  if (!databaseMode()) return new Map();
  try {
    const rows = (await query<{ slug: string; published_at: Date | null }>("SELECT slug,published_at FROM projects WHERE status='published' AND published_at IS NOT NULL")).rows;
    return new Map(rows.map((row) => [row.slug, new Date(row.published_at!)]));
  } catch { return new Map(); }
}
export async function getPublishedNavigation(location: "header" | "footer" = "header") {
  const defaults = location === "header" ? [{ href: "/", label: "Home" }, { href: "/work", label: "Work" }, { href: "/about", label: "About" }, { href: "/contact", label: "Contact" }] : [{ href: "/work", label: "Work" }, { href: "/about", label: "About" }, { href: "/contact", label: "Contact" }];
  if (!databaseMode()) return defaults;
  let rows: { published: Record<string, unknown> | null; visible: boolean }[];
  try { rows = (await query<{ published: Record<string, unknown> | null; visible: boolean }>("SELECT published,visible FROM navigation_items WHERE location=$1 AND status='published' ORDER BY position,id", [location])).rows; }
  catch { console.error("Navigation database read failed; existing public navigation remains active."); return defaults; }
  if (rows.length < defaults.length) return defaults;
  const links = rows.filter((row) => row.visible).map((row) => ({ label: row.published?.label, href: row.published?.href }));
  if (!links.length || links.some((link) => typeof link.label !== "string" || typeof link.href !== "string" || !/^\/(?!\/)/.test(link.href) || /^\/(?:admin|api|faisals-room)(?:\/|$)/i.test(link.href))) return defaults;
  return links as { label: string; href: string }[];
}
