import "server-only";
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { assertDatabaseConfigured, getConfig } from "./config";

export type QueryResultRow = Record<string, unknown>;
export type QueryResult<T extends QueryResultRow = QueryResultRow> = { rows: T[]; rowCount: number };
export type DbClient = { query<T extends QueryResultRow = QueryResultRow>(sql: string, values?: readonly unknown[]): Promise<QueryResult<T>> };

type GlobalPool = typeof globalThis & { __faisalsRoomPool?: Pool };

function mysqlValues(sql: string, values: readonly unknown[]): { sql: string; values: unknown[] } {
  const ordered: unknown[] = [];
  const converted = sql.replace(/\$(\d+)/g, (_match, index: string) => {
    ordered.push(values[Number(index) - 1]);
    return "?";
  });
  return { sql: converted, values: ordered };
}

function result<T extends QueryResultRow>(rows: RowDataPacket[] | ResultSetHeader): QueryResult<T> {
  if (Array.isArray(rows)) return { rows: rows as T[], rowCount: rows.length };
  return { rows: [], rowCount: rows.affectedRows };
}

function makeClient(connection: Pool | PoolConnection): DbClient {
  return {
    async query<T extends QueryResultRow = QueryResultRow>(sql: string, values: readonly unknown[] = []) {
      const prepared = mysqlValues(sql, values);
      const [rows] = await connection.query(prepared.sql, prepared.values);
      return result<T>(rows as RowDataPacket[] | ResultSetHeader);
    },
  };
}

export function getPool(): Pool {
  const env = assertDatabaseConfigured();
  const root = globalThis as GlobalPool;
  root.__faisalsRoomPool ??= mysql.createPool({
    uri: env.DATABASE_URL,
    connectionLimit: 5,
    waitForConnections: true,
    queueLimit: 0,
    connectTimeout: 5_000,
    ssl: getConfig().DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  });
  return root.__faisalsRoomPool;
}

/**
 * Test-only: close the pool so test processes can exit cleanly.
 * Never call in production request handling.
 */
export async function _closePool(): Promise<void> {
  const root = globalThis as GlobalPool;
  if (root.__faisalsRoomPool) {
    await root.__faisalsRoomPool.end();
    delete root.__faisalsRoomPool;
  }
}

export function query<T extends QueryResultRow = QueryResultRow>(sql: string, values: readonly unknown[] = []): Promise<QueryResult<T>> {
  return makeClient(getPool()).query<T>(sql, values);
}

export async function transaction<T>(work: (client: DbClient) => Promise<T>): Promise<T> {
  const connection = await getPool().getConnection();
  const client = makeClient(connection);
  try {
    await connection.beginTransaction();
    const result = await work(client);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Like transaction(), but the work callback receives a control object it can
 * use to request connection destruction: set `control.destroyConnection = true`
 * when session-level state may have leaked (e.g., a GET_LOCK() that could not
 * be released). A destroyed connection is never returned to the pool, so a
 * potentially leaked session-level lock cannot block future work.
 *
 * Use when holding MySQL session-level resources (GET_LOCK) across the
 * transaction: if RELEASE_LOCK fails, the lock may still be held by this
 * connection, and reusing the connection would serialize/block unrelated work.
 */
export async function transactionWithConnectionControl<T>(
  work: (client: DbClient, control: { destroyConnection: boolean }) => Promise<T>,
): Promise<T> {
  const connection = await getPool().getConnection();
  const client = makeClient(connection);
  const control = { destroyConnection: false };
  try {
    await connection.beginTransaction();
    const result = await work(client, control);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    if (control.destroyConnection) connection.destroy();
    else connection.release();
  }
}
