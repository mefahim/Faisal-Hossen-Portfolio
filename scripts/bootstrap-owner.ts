import argon2 from "argon2";
import { Pool } from "pg";
import { z } from "zod";

const config = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(["true", "false"]).default("false"),
  BOOTSTRAP_OWNER_EMAIL: z.string().email(),
  BOOTSTRAP_OWNER_PASSWORD: z.string().min(14).max(256),
}).parse(process.env);
const pool = new Pool({ connectionString: config.DATABASE_URL, ssl: config.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined, max: 1 });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const count = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM users");
    if (Number(count.rows[0]?.count ?? 0) > 0) throw new Error("An owner already exists; bootstrap is one-time and will not replace credentials.");
    const passwordHash = await argon2.hash(config.BOOTSTRAP_OWNER_PASSWORD, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
    const created = await client.query<{ id: string }>("INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id", [config.BOOTSTRAP_OWNER_EMAIL.toLowerCase(), passwordHash]);
    await client.query("INSERT INTO activity_logs(actor_id,action,entity_type,entity_id,safe_metadata,correlation_id) VALUES($1,'auth.owner_bootstrapped','user',$1,'{}'::jsonb,'bootstrap')", [created.rows[0].id]);
    await client.query("COMMIT");
    console.log("Single owner account created. Remove BOOTSTRAP_OWNER_PASSWORD from the environment now.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); await pool.end(); }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Owner bootstrap failed."); process.exitCode = 1; });
