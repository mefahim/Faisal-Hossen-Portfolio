import "server-only";
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { assertDatabaseConfigured, getConfig } from "./config";

type GlobalPool = typeof globalThis & { __faisalsRoomPool?: Pool };

export function getPool(): Pool {
  const env = assertDatabaseConfigured();
  const root = globalThis as GlobalPool;
  root.__faisalsRoomPool ??= new Pool({
    connectionString: env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: getConfig().DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    application_name: "faisals-room",
  });
  return root.__faisalsRoomPool;
}

export function query<T extends QueryResultRow = QueryResultRow>(sql: string, values: readonly unknown[] = []): Promise<QueryResult<T>> {
  return getPool().query<T>(sql, [...values]);
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
