import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import mysql from "mysql2/promise";
import { projects } from "../content/projects";
import { capabilities, contactDetails, problemStates, site, thinkingPrinciples } from "../content/site";
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to seed Faisal’s Room.");
const pool = mysql.createPool({ uri: connectionString, connectionLimit: 1, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined });
const root = process.cwd();
const settings = { site, contactDetails, problemStates, thinkingPrinciples, capabilities };
const pageSeeds = [
  { key: "home", route: "/", title: "Faisal Hossen — Digital Problem Solver", sections: [
    { key: "hero", type: "hero", position: 0, content: { eyebrow: `${site.label} · ${site.context}`, heading: site.positioning, supporting: site.supporting } },
    { key: "workbench", type: "workbench", position: 1, content: { heading: "Show the thinking, not just the finished screen." } },
    { key: "selected-work", type: "project-index", position: 2, content: { projectSlugs: projects.map((project) => project.slug) } },
  ] },
  { key: "work", route: "/work", title: "Selected Work", sections: [{ key: "hero", type: "hero", position: 0, content: { heading: "A few problems I've helped make clearer.", supporting: "Three project stories from the available source material." } }] },
  { key: "about", route: "/about", title: "About Faisal Hossen", sections: [{ key: "point-of-view", type: "copy", position: 0, content: { heading: "Start with the problem, not the platform.", supporting: site.supporting, principles: thinkingPrinciples } }] },
  { key: "contact", route: "/contact", title: "Contact Faisal Hossen", sections: [{ key: "contact-intro", type: "copy", position: 0, content: { supporting: "Start a conversation about a website, product experience, AI, automation, UX, or SEO problem." } }] },
  ...projects.map((project) => ({ key: `work/${project.slug}`, route: `/work/${project.slug}`, title: project.title, sections: [{ key: "case-study", type: "case-study", position: 0, content: { slug: project.slug, title: project.title, summary: project.summary, challenge: project.challenge, solutions: project.solutions, approach: project.approach } }] })),
];
const navSeeds = [
  { location: "header", label: "Home", href: "/", position: 0, visible: true }, { location: "header", label: "Work", href: "/work", position: 1, visible: true }, { location: "header", label: "About", href: "/about", position: 2, visible: true }, { location: "header", label: "Contact", href: "/contact", position: 3, visible: true },
  { location: "footer", label: "Work", href: "/work", position: 0, visible: true }, { location: "footer", label: "About", href: "/about", position: 1, visible: true }, { location: "footer", label: "Contact", href: "/contact", position: 2, visible: true },
];
const seoSeeds = [
  { route: "/", title: site.positioning, description: site.supporting }, { route: "/work", title: "Selected Work", description: "A selection of verified project notes covering web experiences, reusable systems, and interactive product work." }, { route: "/about", title: "About Faisal Hossen", description: "The point of view, working style, and practical approach behind Faisal Hossen’s digital work." }, { route: "/contact", title: "Contact Faisal Hossen", description: "Start a conversation with Faisal Hossen about a website, product experience, AI, automation, UX, or SEO problem." },
  ...projects.map((project) => ({ route: `/work/${project.slug}`, title: project.title, description: project.summary })),
].map(({ route, title, description }) => ({ route, title, description, robots: "index,follow" }));
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
      for (const section of page.sections) await client.query("INSERT IGNORE INTO page_sections(id,page_id,section_key,section_type,position,draft,status) VALUES(?,?,?,?,?,'draft')", [randomUUID(), id, section.key, section.type, section.position, JSON.stringify(section.content)]);
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
