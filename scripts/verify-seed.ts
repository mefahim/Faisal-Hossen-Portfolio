import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import sharp from "sharp";
import { projects } from "../content/projects";
import { navSeeds, pageSeeds, seoSeeds, settings } from "./seed-data";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to verify seed parity.");
const pool = mysql.createPool({ uri: connectionString, connectionLimit: 1, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined });

function json(value: unknown): unknown {
  if (typeof value === "string") return JSON.parse(value);
  if (Buffer.isBuffer(value)) return JSON.parse(value.toString("utf8"));
  return value;
}
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalize(item)]));
  return value;
}
function same(a: unknown, b: unknown): boolean { return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b)); }
function ensure(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

async function main() {
  try {
    const [settingsRows] = await pool.query("SELECT draft,status,published FROM site_settings WHERE id='default'");
    const setting = (settingsRows as { draft: unknown; status: string; published: unknown }[])[0];
    ensure(setting && setting.status === "draft" && setting.published === null && same(json(setting.draft), settings), "Site settings seed differs from the verified file-backed source or is no longer draft-only.");

    const [projectRows] = await pool.query("SELECT slug,position,draft,status,published FROM projects ORDER BY position,slug");
    const seededProjects = projectRows as { slug: string; position: number; draft: unknown; status: string; published: unknown }[];
    ensure(seededProjects.length === projects.length, `Expected ${projects.length} projects, found ${seededProjects.length}.`);
    for (const [index, row] of seededProjects.entries()) {
      const source = projects[index];
      ensure(source && row.slug === source.slug && Number(row.position) === index && row.status === "draft" && row.published === null && same(json(row.draft), source), `Project seed parity failed: ${row.slug}.`);
    }

    const [pageRows] = await pool.query("SELECT `key` AS page_key,route,title,draft,status,published FROM pages ORDER BY `key`");
    const seededPages = pageRows as { page_key: string; route: string; title: string; draft: unknown; status: string; published: unknown }[];
    ensure(seededPages.length === pageSeeds.length, `Expected ${pageSeeds.length} pages, found ${seededPages.length}.`);
    for (const source of pageSeeds) {
      const row = seededPages.find((item) => item.page_key === source.key);
      ensure(row && row.route === source.route && row.title === source.title && row.status === "draft" && row.published === null && same(json(row.draft), source), `Page seed parity failed: ${source.key}.`);
    }

    const expectedSections = pageSeeds.flatMap((page) => page.sections.map((section) => ({ pageKey: page.key, ...section })));
    const [sectionRows] = await pool.query("SELECT p.`key` AS page_key,ps.section_key,ps.section_type,ps.position,ps.draft,ps.status,ps.published FROM page_sections ps JOIN pages p ON p.id=ps.page_id ORDER BY p.`key`,ps.position,ps.section_key");
    const seededSections = sectionRows as { page_key: string; section_key: string; section_type: string; position: number; draft: unknown; status: string; published: unknown }[];
    ensure(seededSections.length === expectedSections.length, `Expected ${expectedSections.length} page sections, found ${seededSections.length}.`);
    for (const source of expectedSections) {
      const row = seededSections.find((item) => item.page_key === source.pageKey && item.section_key === source.key);
      ensure(row && row.section_type === source.type && Number(row.position) === source.position && row.status === "draft" && row.published === null && same(json(row.draft), source.content), `Page-section seed parity failed: ${source.pageKey}/${source.key}.`);
    }

    const [navigationRows] = await pool.query("SELECT location,label,href,position,visible,draft,status,published FROM navigation_items ORDER BY location,position,href");
    const seededNavigation = navigationRows as { location: string; label: string; href: string; position: number; visible: number | boolean; draft: unknown; status: string; published: unknown }[];
    ensure(seededNavigation.length === navSeeds.length, `Expected ${navSeeds.length} navigation items, found ${seededNavigation.length}.`);
    for (const source of navSeeds) {
      const row = seededNavigation.find((item) => item.location === source.location && item.href === source.href);
      ensure(row && row.label === source.label && Number(row.position) === source.position && Boolean(row.visible) === source.visible && row.status === "draft" && row.published === null && same(json(row.draft), source), `Navigation seed parity failed: ${source.location}/${source.href}.`);
    }

    const [seoRows] = await pool.query("SELECT route,draft,status,published FROM seo_metadata ORDER BY route");
    const seededSeo = seoRows as { route: string; draft: unknown; status: string; published: unknown }[];
    ensure(seededSeo.length === seoSeeds.length, `Expected ${seoSeeds.length} SEO records, found ${seededSeo.length}.`);
    for (const source of seoSeeds) {
      const row = seededSeo.find((item) => item.route === source.route);
      const expectedDraft = { title: source.title, description: source.description, robots: source.robots };
      ensure(row && row.status === "draft" && row.published === null && same(json(row.draft), expectedDraft), `SEO seed parity failed: ${source.route}.`);
    }

    const [mediaRows] = await pool.query("SELECT id,storage_key,mime_type,byte_size,width,height,checksum_sha256,alt_text,derivatives FROM media");
    const seededMedia = mediaRows as { id: string; storage_key: string; mime_type: string; byte_size: number | string; width: number; height: number; checksum_sha256: string; alt_text: string; derivatives: unknown }[];
    const [coverRows] = await pool.query("SELECT p.slug,pm.media_id,pm.role,pm.position,pm.alt_text FROM project_media pm JOIN projects p ON p.id=pm.project_id WHERE pm.role='cover'");
    const seededCovers = coverRows as { slug: string; media_id: string; role: string; position: number; alt_text: string }[];
    ensure(seededCovers.length === projects.length, `Expected ${projects.length} seeded project cover references, found ${seededCovers.length}.`);
    const mimeByFormat: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" };
    for (const project of projects) {
      const relative = project.image.replace(/^\//, "");
      const bytes = await readFile(path.join(process.cwd(), "public", relative));
      const info = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
      const key = `legacy-public/${relative}`;
      const row = seededMedia.find((item) => item.storage_key === key);
      const checksum = createHash("sha256").update(bytes).digest("hex");
      ensure(row && info.format && row.mime_type === mimeByFormat[info.format] && Number(row.byte_size) === bytes.length && Number(row.width) === info.width && Number(row.height) === info.height && row.checksum_sha256 === checksum && row.alt_text === project.imageAlt && same(json(row.derivatives), { original: project.image, legacyPublicAsset: true }), `Seeded image metadata/checksum parity failed: ${project.slug}.`);
      const cover = seededCovers.find((item) => item.slug === project.slug);
      ensure(cover && cover.media_id === row.id && Number(cover.position) === 0 && cover.alt_text === project.imageAlt, `Project cover reference parity failed: ${project.slug}.`);
    }

    console.log(`Seed parity passed against checked-in sources: settings; ${seededProjects.length} projects; ${seededPages.length} pages and ${seededSections.length} sections; ${seededNavigation.length} navigation items; ${seededSeo.length} SEO records; and ${projects.length} project-image byte counts, dimensions, SHA-256 checksums, alt text, and cover references. Seeded content remains draft-only.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed parity verification failed.");
  process.exitCode = 1;
});
