import { Pool } from "pg";
import { projects } from "../content/projects";
import { capabilities, contactDetails, problemStates, site, thinkingPrinciples } from "../content/site";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to verify seed parity.");
const pool = new Pool({ connectionString, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined, max: 1 });
const expectedSettings = { site, contactDetails, problemStates, thinkingPrinciples, capabilities };
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalize(item)]));
  return value;
}
function same(a: unknown, b: unknown) { return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b)); }

async function main() {
  try {
    const setting = (await pool.query<{ draft: unknown }>("SELECT draft FROM site_settings WHERE id='default'")).rows[0];
    if (!setting || !same(setting.draft, expectedSettings)) throw new Error("Site settings seed differs from the verified file-backed source.");
    const rows = (await pool.query<{ slug: string; draft: unknown }>("SELECT slug,draft FROM projects ORDER BY slug")).rows;
    const expected = new Map(projects.map((project) => [project.slug, project]));
    if (rows.length !== projects.length) throw new Error(`Expected ${projects.length} project records, found ${rows.length}.`);
    for (const row of rows) {
      const source = expected.get(row.slug);
      if (!source || !same(row.draft, source)) throw new Error(`Project seed parity failed: ${row.slug}`);
    }
    console.log(`Seed parity passed: settings plus ${rows.length} project drafts exactly match the checked-in verified sources.`);
  } finally { await pool.end(); }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Seed parity verification failed."); process.exitCode = 1; });
