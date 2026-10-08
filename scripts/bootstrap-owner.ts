import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import mysql from "mysql2/promise";
import { z } from "zod";
const config = z.object({ DATABASE_URL: z.string().min(1), DATABASE_SSL: z.enum(["true", "false"]).default("false"), BOOTSTRAP_OWNER_EMAIL: z.string().email(), BOOTSTRAP_OWNER_PASSWORD: z.string().min(14).max(256) }).parse(process.env);
const pool = mysql.createPool({ uri: config.DATABASE_URL, connectionLimit: 1, ssl: config.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined });
async function main() {
  const client = await pool.getConnection();
  try {
    await client.beginTransaction();
    const [countRows] = await client.query("SELECT COUNT(*) AS count FROM users");
    if (Number((countRows as { count: number }[])[0]?.count ?? 0) > 0) throw new Error("An owner already exists; bootstrap is one-time and will not replace credentials.");
    const passwordHash = await argon2.hash(config.BOOTSTRAP_OWNER_PASSWORD, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
    const id = randomUUID();
    await client.query("INSERT INTO users(id,email,password_hash) VALUES(?,?,?)", [id, config.BOOTSTRAP_OWNER_EMAIL.toLowerCase(), passwordHash]);
    await client.query("INSERT INTO activity_logs(id,actor_id,action,entity_type,entity_id,safe_metadata,correlation_id) VALUES(?,?, 'auth.owner_bootstrapped','user',?,'{}', 'bootstrap')", [randomUUID(), id, id]);
    await client.commit();
    console.log("Single owner account created. Remove BOOTSTRAP_OWNER_PASSWORD from the environment now.");
  } catch (error) { await client.rollback().catch(() => undefined); throw error; } finally { client.release(); await pool.end(); }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Owner bootstrap failed."); process.exitCode = 1; });
