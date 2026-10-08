import "server-only";
import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { query, transaction } from "../db";
import { clientAddress, digest, privateKey } from "../security";

export const SESSION_COOKIE = "fr_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const ARGON_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export type OwnerSession = { id: string; userId: string; email: string; expiresAt: Date };
export class UnauthorizedError extends Error { constructor() { super("Authentication required."); this.name = "UnauthorizedError"; } }

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 14 || password.length > 256) throw new Error("Password must be between 14 and 256 characters.");
  return argon2.hash(password, ARGON_OPTIONS);
}
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try { return await argon2.verify(hash, password); } catch { return false; }
}

export async function getOwnerSession(): Promise<OwnerSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || token.length < 40 || token.length > 200) return null;
  const result = await query<{ id: string; user_id: string; email: string; expires_at: Date }>(
    `SELECT s.id, s.user_id, u.email, s.expires_at
     FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.is_active=true LIMIT 1`,
    [digest(token)],
  );
  const row = result.rows[0];
  if (!row) return null;
  void query("UPDATE sessions SET last_seen_at=now() WHERE id=$1", [row.id]).catch(() => undefined);
  return { id: row.id, userId: row.user_id, email: row.email, expiresAt: row.expires_at };
}

export async function requireOwner(): Promise<OwnerSession> {
  const session = await getOwnerSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}
export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
}

export async function startOwnerSession(userId: string, userAgent: string | null) {
  const token = randomBytes(32).toString("base64url");
  const uaHash = userAgent ? digest(userAgent.slice(0, 300)) : null;
  await query(
    "INSERT INTO sessions(user_id, token_hash, expires_at, user_agent_hash) VALUES($1,$2,now() + ($3::int * interval '1 second'),$4)",
    [userId, digest(token), SESSION_TTL_SECONDS, uaHash],
  );
  await setSessionCookie(token);
}
export async function revokeCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await query("UPDATE sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL", [digest(token)]);
  await clearSessionCookie();
}

export async function checkLoginThrottle(email: string, request: Request): Promise<{ allowed: boolean; retrySeconds: number }> {
  const key = privateKey(`${email.toLowerCase()}|${clientAddress(request)}`);
  const row = (await query<{ attempts: number; locked_until: Date | null }>("SELECT attempts, locked_until FROM login_attempts WHERE subject_hash=$1", [key])).rows[0];
  if (row?.locked_until && row.locked_until.getTime() > Date.now()) return { allowed: false, retrySeconds: Math.ceil((row.locked_until.getTime() - Date.now()) / 1000) };
  return { allowed: true, retrySeconds: 0 };
}

export async function recordLoginFailure(email: string, request: Request) {
  const key = privateKey(`${email.toLowerCase()}|${clientAddress(request)}`);
  await query(
    `INSERT INTO login_attempts(subject_hash, attempts, window_started_at, locked_until, updated_at)
     VALUES($1,1,now(),NULL,now())
     ON CONFLICT(subject_hash) DO UPDATE SET
       attempts=CASE WHEN login_attempts.window_started_at < now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,
       window_started_at=CASE WHEN login_attempts.window_started_at < now()-interval '15 minutes' THEN now() ELSE login_attempts.window_started_at END,
       locked_until=CASE WHEN (CASE WHEN login_attempts.window_started_at < now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END) >= 5 THEN now()+interval '15 minutes' ELSE NULL END,
       updated_at=now()`,
    [key],
  );
}
export async function clearLoginFailures(email: string, request: Request) {
  const key = privateKey(`${email.toLowerCase()}|${clientAddress(request)}`);
  await query("DELETE FROM login_attempts WHERE subject_hash=$1", [key]);
}

export async function changeOwnerPassword(session: OwnerSession, currentPassword: string, nextPassword: string, requestId: string) {
  const user = (await query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id=$1 AND is_active=true", [session.userId])).rows[0];
  if (!user || !(await verifyPassword(user.password_hash, currentPassword))) throw new Error("Current password is incorrect.");
  const nextHash = await hashPassword(nextPassword);
  await transaction(async (client) => {
    await client.query("UPDATE users SET password_hash=$1, password_changed_at=now(), updated_at=now() WHERE id=$2", [nextHash, session.userId]);
    await client.query("UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL", [session.userId]);
    await client.query("INSERT INTO activity_logs(actor_id,action,entity_type,entity_id,safe_metadata,correlation_id) VALUES($1,'auth.password_changed','user',$1,'{}'::jsonb,$2)", [session.userId, requestId]);
  });
  await startOwnerSession(session.userId, null);
}
