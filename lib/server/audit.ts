import "server-only";
import { randomUUID } from "node:crypto";
import { query } from "./db";
const safeKey = /^[a-zA-Z0-9_.:-]{1,100}$/;
export async function recordActivity(input: { actorId?: string | null; action: string; entityType?: string; entityId?: string; metadata?: Record<string, string | number | boolean | null>; requestId: string }) {
  const action = input.action.slice(0, 80);
  const entityType = input.entityType?.slice(0, 40) ?? null;
  const entityId = input.entityId && safeKey.test(input.entityId) ? input.entityId : null;
  const metadata = Object.fromEntries(Object.entries(input.metadata ?? {}).filter(([key, value]) => safeKey.test(key) && (value === null || ["string", "number", "boolean"].includes(typeof value))).slice(0, 20));
  await query("INSERT INTO activity_logs(id,actor_id,action,entity_type,entity_id,safe_metadata,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7)", [randomUUID(), input.actorId ?? null, action, entityType, entityId, JSON.stringify(metadata), input.requestId]);
}
