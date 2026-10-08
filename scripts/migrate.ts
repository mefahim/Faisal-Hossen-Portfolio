import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to run migrations.");
const pool = new Pool({ connectionString, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('faisals-room-migrations'))");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
    const applied = new Set((await client.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((row) => row.name));
    const dir = path.join(process.cwd(), "db/migrations");
    const migrations = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
    for (const name of migrations) {
      if (applied.has(name)) continue;
      const sql = await readFile(path.join(dir, name), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [name]);
        await client.query("COMMIT");
        console.log(`Applied ${name}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    if (!migrations.some((name) => !applied.has(name))) console.log("Database schema is up to date.");
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('faisals-room-migrations'))").catch(() => undefined);
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Migration failed.");
  process.exitCode = 1;
});
