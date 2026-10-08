import "server-only";
import { transaction, query } from "./db";
import { privateKey } from "./security";

export async function consumeRateLimit(bucket: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; retrySeconds: number }> {
  const key = privateKey(bucket);
  if (Math.random() < 0.01) void query("DELETE FROM request_limits WHERE updated_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)").catch(() => undefined);
  const window = Math.max(1, Math.floor(windowSeconds));
  return transaction(async (client) => {
    await client.query(
      `INSERT INTO request_limits(bucket_hash,hits,window_started_at,updated_at) VALUES($1,1,NOW(),NOW())
       ON DUPLICATE KEY UPDATE
         hits=IF(window_started_at < DATE_SUB(NOW(), INTERVAL ${window} SECOND), 1, hits+1),
         window_started_at=IF(window_started_at < DATE_SUB(NOW(), INTERVAL ${window} SECOND), NOW(), window_started_at),
         updated_at=NOW()`,
      [key],
    );
    const row = (await client.query<{ hits: number; window_started_at: Date }>(
      "SELECT hits,window_started_at FROM request_limits WHERE bucket_hash=$1 FOR UPDATE",
      [key],
    )).rows[0];
    const allowed = Boolean(row && Number(row.hits) <= limit);
    const retrySeconds = row ? Math.max(1, Math.ceil((new Date(row.window_started_at).getTime() + window * 1000 - Date.now()) / 1000)) : window;
    return { allowed, retrySeconds };
  });
}
