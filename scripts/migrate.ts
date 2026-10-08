import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to run migrations.");
const pool = mysql.createPool({ uri: connectionString, connectionLimit: 1, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined });
async function main() {
  const client = await pool.getConnection();
  try {
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(190) PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))");
    const [appliedRows] = await client.query<mysql.RowDataPacket[]>("SELECT name FROM schema_migrations");
    const applied = new Set((appliedRows as { name: string }[]).map((row) => row.name));
    const dir = path.join(process.cwd(), "db/migrations");
    const migrations = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
    for (const name of migrations) {
      if (applied.has(name)) continue;
      const sql = await readFile(path.join(dir, name), "utf8");
      await client.beginTransaction();
      try {
        for (const statement of sql.split(/;\s*(?:\n|$)/).map((item) => item.trim()).filter(Boolean)) await client.query(statement);
        await client.query("INSERT INTO schema_migrations(name) VALUES (?)", [name]);
        await client.commit();
        console.log(`Applied ${name}`);
      } catch (error) {
        await client.rollback();
        throw error;
      }
    }
    if (!migrations.some((name) => !applied.has(name))) console.log("Database schema is up to date.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Migration failed.");
  process.exitCode = 1;
});
