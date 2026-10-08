import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import mysql from "mysql2/promise";
import { projects } from "../content/projects";
import { navSeeds, pageSeeds, seoSeeds, settings } from "./seed-data";
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to seed Faisal’s Room.");
const pool = mysql.createPool({ uri: connectionString, connectionLimit: 1, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined });
const root = process.cwd();
async function main() {
  const client = await pool.getConnection();
  try {
    await client.beginTransaction();
    await client.query("INSERT IGNORE INTO site_settings(id,draft,status) VALUES('default',?,'draft')", [JSON.stringify(settings)]);
    for (const page of pageSeeds) {
      const pageId = randomUUID();
      await client.query("INSERT IGNORE INTO pages(id,`key`,route,title,draft,status) VALUES(?,?,?,?,?,'draft')", [pageId, page.key, page.route, page.title, JSON.stringify(page)]);
      const [existing] = await client.query("SELECT id FROM pages WHERE `key`=?", [page.key]);
      const id = (existing as { id: string }[])[0]?.id;
      if (!id) throw new Error(`Unable to seed page ${page.key}`);
      for (const section of page.sections) await client.query("INSERT IGNORE INTO page_sections(id,page_id,section_key,section_type,position,draft,status) VALUES(?,?,?,?,?,?,'draft')", [randomUUID(), id, section.key, section.type, section.position, JSON.stringify(section.content)]);
    }
    for (const [position, project] of projects.entries()) await client.query("INSERT IGNORE INTO projects(id,slug,position,draft,status) VALUES(?,?,?,?,'draft')", [randomUUID(), project.slug, position, JSON.stringify(project)]);
    for (const item of navSeeds) await client.query("INSERT INTO navigation_items(id,location,label,href,position,visible,draft,status) SELECT ?,?,?,?,?,?,?,'draft' WHERE NOT EXISTS(SELECT 1 FROM navigation_items WHERE location=? AND href=?)", [randomUUID(), item.location, item.label, item.href, item.position, item.visible, JSON.stringify(item), item.location, item.href]);
    for (const item of seoSeeds) await client.query("INSERT IGNORE INTO seo_metadata(id,route,draft,status) VALUES(?,?,?,'draft')", [randomUUID(), item.route, JSON.stringify({ title: item.title, description: item.description, robots: item.robots })]);
    for (const project of projects) {
      const relative = project.image.replace(/^\//, "");
      const bytes = await readFile(path.join(root, "public", relative));
      const info = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
      if (!info.width || !info.height) throw new Error(`Image dimensions unavailable: ${project.image}`);
      const mimeByFormat: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" };
      const mimeType = info.format ? mimeByFormat[info.format] : undefined;
      if (!mimeType) throw new Error(`Unsupported source image format: ${project.image}`);
      const key = `legacy-public/${relative}`;
      const sum = createHash("sha256").update(bytes).digest("hex");
      await client.query("INSERT INTO media(id,storage_key,mime_type,byte_size,width,height,checksum_sha256,alt_text,derivatives) VALUES(?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE alt_text=VALUES(alt_text)", [randomUUID(), key, mimeType, bytes.length, info.width, info.height, sum, project.imageAlt, JSON.stringify({ original: project.image, legacyPublicAsset: true })]);
      const [mediaRows] = await client.query("SELECT id FROM media WHERE storage_key=?", [key]);
      const mediaId = (mediaRows as { id: string }[])[0]?.id;
      const [projectRows] = await client.query("SELECT id FROM projects WHERE slug=?", [project.slug]);
      const projectId = (projectRows as { id: string }[])[0]?.id;
      if (projectId && mediaId) await client.query("INSERT IGNORE INTO project_media(project_id,media_id,role,position,alt_text) VALUES(?,?, 'cover',0,?)", [projectId, mediaId, project.imageAlt]);
    }
    await client.commit();
    console.log(`Seeded or preserved site settings, ${pageSeeds.length} pages, ${projects.length} projects, ${navSeeds.length} navigation items, ${seoSeeds.length} SEO foundation records, and project media metadata. All seeded content remains draft until explicitly reviewed and published.`);
  } catch (error) { await client.rollback().catch(() => undefined); throw error; } finally { client.release(); await pool.end(); }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Seed failed."); process.exitCode = 1; });
