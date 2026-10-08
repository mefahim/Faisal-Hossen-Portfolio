import mysql from "mysql2/promise";
import { projects } from "../content/projects";
import { capabilities, contactDetails, problemStates, site, thinkingPrinciples } from "../content/site";
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to verify seed parity.");
const pool = mysql.createPool({ uri: connectionString, connectionLimit: 1, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined });
const expectedSettings = { site, contactDetails, problemStates, thinkingPrinciples, capabilities };
function normalize(value: unknown): unknown { if (Array.isArray(value)) return value.map(normalize); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalize(item)])); return value; }
function same(a: unknown, b: unknown) { return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b)); }
async function main() {
  try {
    const [settings] = await pool.query("SELECT draft FROM site_settings WHERE id='default'");
    const setting = (settings as { draft: unknown }[])[0];
    if (!setting || !same(typeof setting.draft === "string" ? JSON.parse(setting.draft) : setting.draft, expectedSettings)) throw new Error("Site settings seed differs from the verified file-backed source.");
    const [projectRows] = await pool.query("SELECT slug,draft FROM projects ORDER BY slug");
    const rows = projectRows as { slug: string; draft: unknown }[];
    const expected = new Map(projects.map((project) => [project.slug, project]));
    if (rows.length !== projects.length) throw new Error(`Expected ${projects.length} project records, found ${rows.length}.`);
    for (const row of rows) { const source = expected.get(row.slug); const draft = typeof row.draft === "string" ? JSON.parse(row.draft) : row.draft; if (!source || !same(draft, source)) throw new Error(`Project seed parity failed: ${row.slug}`); }
    const [pageCount] = await pool.query("SELECT COUNT(*) AS count FROM pages");
    const [navCount] = await pool.query("SELECT COUNT(*) AS count FROM navigation_items");
    const [seoCount] = await pool.query("SELECT COUNT(*) AS count FROM seo_metadata");
    const expectedPages = 4 + projects.length;
    if (Number((pageCount as { count: number }[])[0].count) !== expectedPages) throw new Error("Page seed parity failed.");
    if (Number((navCount as { count: number }[])[0].count) !== 7) throw new Error("Navigation seed parity failed.");
    if (Number((seoCount as { count: number }[])[0].count) !== expectedPages) throw new Error("SEO seed parity failed.");
    console.log(`Seed parity passed: settings, ${rows.length} projects, ${expectedPages} pages, 7 navigation items, and ${expectedPages} SEO records match the checked-in sources.`);
  } finally { await pool.end(); }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Seed parity verification failed."); process.exitCode = 1; });
