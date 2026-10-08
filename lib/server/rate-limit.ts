import "server-only";
import { query } from "./db";
import { privateKey } from "./security";

export async function consumeRateLimit(bucket: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; retrySeconds: number }> {
  const key = privateKey(bucket);
  if (Math.random() < 0.01) void query("DELETE FROM request_limits WHERE updated_at < now()-interval '24 hours'").catch(() => undefined);
  const row = (await query<{ hits: number; window_started_at: Date }>(
    `INSERT INTO request_limits(bucket_hash,hits,window_started_at,updated_at) VALUES($1,1,now(),now())
     ON CONFLICT(bucket_hash) DO UPDATE SET
       hits=CASE WHEN request_limits.window_started_at < now()-($2::int * interval '1 second') THEN 1 ELSE request_limits.hits+1 END,
       window_started_at=CASE WHEN request_limits.window_started_at < now()-($2::int * interval '1 second') THEN now() ELSE request_limits.window_started_at END,
       updated_at=now()
     RETURNING hits,window_started_at`, [key, windowSeconds])).rows[0];
  const allowed = Boolean(row && row.hits <= limit);
  const retrySeconds = row ? Math.max(1, Math.ceil((new Date(row.window_started_at).getTime() + windowSeconds * 1000 - Date.now()) / 1000)) : windowSeconds;
  return { allowed, retrySeconds };
}
