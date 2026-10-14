/**
 * M4: Database integration tests for the analytics token lifecycle.
 *
 * These tests run against a real disposable MySQL/MariaDB database
 * (DATABASE_URL must point at it; the suite skips gracefully otherwise).
 * They exercise the actual SQL, transactions, locks, and auth gates —
 * not mocks of the database layer.
 *
 * Test-only encryption key and mock network implementations are used.
 * Never point DATABASE_URL at production.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  storeTokens,
  getValidAccessToken,
  getConnectionStatus,
  disconnectProvider,
  setPropertyId,
  _setTokenRefresh,
  _setTokenRevoker,
  _setSessionOverride,
  _clearSessionOverride,
  needsRefresh,
} from "../lib/server/analytics/tokens";
import { query, transaction, _closePool } from "../lib/server/db";
import { generateTestEncryptionKey, isTestDatabaseAvailable, runMigrations } from "./db-test-utils";

const dbAvailable = isTestDatabaseAvailable();
const skipNoDb = { skip: dbAvailable ? false : "DATABASE_URL not set; database integration tests skipped." } as const;

const ACTOR = "test-owner-id";
const OTHER_ACTOR = "other-owner-id";

function futureExpiry(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

test("DB setup: migrate, key, session override", { skip: !dbAvailable }, async () => {
  process.env.OAUTH_ENCRYPTION_KEY = generateTestEncryptionKey();
  await runMigrations(process.cwd());
  await query("DELETE FROM analytics_cache");
  await query("DELETE FROM provider_tokens");
  _setSessionOverride({ userId: ACTOR });
  _setTokenRefresh(null);
  _setTokenRevoker(null);
});

test("initial token storage sets connected_at and NULL last_refresh_at", skipNoDb, async () => {
  await storeTokens("ga4", { accessToken: "a1", refreshToken: "r1", expiresAt: futureExpiry(60) }, ACTOR, "123");
  const rows = await query<{ connected_at: Date; last_refresh_at: Date | null; property_id: string }>(
    "SELECT connected_at, last_refresh_at, property_id FROM provider_tokens WHERE provider=$1",
    ["ga4"],
  );
  assert.equal(rows.rowCount, 1);
  assert.ok(rows.rows[0].connected_at instanceof Date);
  assert.equal(rows.rows[0].last_refresh_at, null);
  assert.equal(rows.rows[0].property_id, "123");
  // Tokens must be encrypted at rest.
  const enc = await query<{ encrypted_access_token: string }>(
    "SELECT encrypted_access_token FROM provider_tokens WHERE provider=$1",
    ["ga4"],
  );
  assert.ok(!enc.rows[0].encrypted_access_token.includes("a1"));
});

test("getValidAccessToken fast path returns decrypted token without refresh", skipNoDb, async () => {
  let refreshCalls = 0;
  _setTokenRefresh(async () => {
    refreshCalls++;
    return { accessToken: "x", refreshToken: "y", expiresAt: futureExpiry(60) };
  });
  const token = await getValidAccessToken("ga4", ACTOR);
  assert.equal(token, "a1");
  assert.equal(refreshCalls, 0);
  _setTokenRefresh(null);
});

test("refresh preserves connected_at and sets last_refresh_at", skipNoDb, async () => {
  const before = await query<{ connected_at: Date }>("SELECT connected_at FROM provider_tokens WHERE provider=$1", ["ga4"]);
  const originalConnectedAt = before.rows[0].connected_at.getTime();

  // Force expiry into the refresh window.
  await query("UPDATE provider_tokens SET token_expiry = DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 1 MINUTE) WHERE provider=$1", ["ga4"]);
  _setTokenRefresh(async (refreshToken) => {
    assert.equal(refreshToken, "r1");
    return { accessToken: "a2", refreshToken: "r2", expiresAt: futureExpiry(60) };
  });
  const token = await getValidAccessToken("ga4", ACTOR);
  assert.equal(token, "a2");

  const after = await query<{ connected_at: Date; last_refresh_at: Date | null; property_id: string }>(
    "SELECT connected_at, last_refresh_at, property_id FROM provider_tokens WHERE provider=$1",
    ["ga4"],
  );
  assert.equal(after.rows[0].connected_at.getTime(), originalConnectedAt, "connected_at must be preserved across refresh");
  assert.ok(after.rows[0].last_refresh_at instanceof Date, "last_refresh_at must be set after refresh");
  assert.equal(after.rows[0].property_id, "123", "property_id must survive refresh");
  _setTokenRefresh(null);
});

test("concurrent refresh: only one network refresh happens (H1)", skipNoDb, async () => {
  await query("UPDATE provider_tokens SET token_expiry = DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 1 MINUTE) WHERE provider=$1", ["ga4"]);
  let refreshCalls = 0;
  _setTokenRefresh(async () => {
    refreshCalls++;
    // Small delay to widen the race window.
    await new Promise((r) => setTimeout(r, 200));
    return { accessToken: `a-concurrent-${refreshCalls}`, refreshToken: "r3", expiresAt: futureExpiry(60) };
  });
  const results = await Promise.all([
    getValidAccessToken("ga4", ACTOR),
    getValidAccessToken("ga4", ACTOR),
    getValidAccessToken("ga4", ACTOR),
  ]);
  // All callers get a valid token; only one performed the network refresh.
  assert.equal(refreshCalls, 1, `expected exactly 1 refresh, got ${refreshCalls}`);
  assert.ok(results.every((t) => t.startsWith("a-concurrent-")));
  _setTokenRefresh(null);
});

test("refresh failure leaves old tokens intact", skipNoDb, async () => {
  await query("UPDATE provider_tokens SET token_expiry = DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 1 MINUTE) WHERE provider=$1", ["ga4"]);
  _setTokenRefresh(async () => {
    throw new Error("Google is down");
  });
  await assert.rejects(() => getValidAccessToken("ga4", ACTOR), /Google is down/);
  // Old row must be untouched (transaction rolled back).
  const rows = await query<{ token_expiry: Date }>("SELECT token_expiry FROM provider_tokens WHERE provider=$1", ["ga4"]);
  assert.equal(rows.rowCount, 1);
  _setTokenRefresh(null);
});

test("setPropertyId updates and validates", skipNoDb, async () => {
  await setPropertyId("ga4", "properties/456", ACTOR);
  const rows = await query<{ property_id: string }>("SELECT property_id FROM provider_tokens WHERE provider=$1", ["ga4"]);
  assert.equal(rows.rows[0].property_id, "456");
  await assert.rejects(() => setPropertyId("ga4", "not-a-property", ACTOR), /Invalid GA4 property/);
});

test("getConnectionStatus returns metadata only, never tokens", skipNoDb, async () => {
  const status = await getConnectionStatus("ga4", ACTOR);
  assert.ok(status);
  assert.equal(status.provider, "ga4");
  assert.equal(status.propertyId, "456");
  assert.ok(!("accessToken" in status));
  assert.ok(JSON.stringify(status).indexOf("a2") === -1, "tokens must not leak into status");
});

test("disconnect attempts revocation then deletes locally (L1)", skipNoDb, async () => {
  // Seed a cache row to verify purge.
  await query(
    "INSERT INTO analytics_cache(id, provider, property_id, date_range, report_type, data_json) VALUES($1,$2,$3,$4,$5,$6)",
    [randomUUID(), "ga4", "456", "7d", "overview", JSON.stringify({})],
  );
  let revokedWith: string | null = null;
  _setTokenRevoker(async (refreshToken) => {
    revokedWith = refreshToken;
  });
  await disconnectProvider("ga4", ACTOR);
  assert.equal(revokedWith, "r3", "revoker must receive the decrypted refresh token");
  const tokens = await query("SELECT provider FROM provider_tokens WHERE provider=$1", ["ga4"]);
  const cache = await query("SELECT provider FROM analytics_cache WHERE provider=$1", ["ga4"]);
  assert.equal(tokens.rowCount, 0, "tokens must be deleted");
  assert.equal(cache.rowCount, 0, "cache must be purged");
  _setTokenRevoker(null);
});

test("disconnect proceeds with local deletion when revocation fails (L1)", skipNoDb, async () => {
  await storeTokens("ga4", { accessToken: "a9", refreshToken: "r9", expiresAt: futureExpiry(60) }, ACTOR);
  _setTokenRevoker(async () => {
    throw new Error("revocation endpoint down");
  });
  await disconnectProvider("ga4", ACTOR); // must not throw
  const tokens = await query("SELECT provider FROM provider_tokens WHERE provider=$1", ["ga4"]);
  assert.equal(tokens.rowCount, 0, "local deletion must not be skipped on revocation failure");
  _setTokenRevoker(null);
});

test("transaction rollback restores state on failure", skipNoDb, async () => {
  await assert.rejects(
    () =>
      transaction(async (client) => {
        await client.query("INSERT INTO provider_tokens(id, provider, encrypted_access_token, encrypted_refresh_token, token_expiry, property_id, connected_by) VALUES($1,$2,$3,$4,$5,$6,$7)", [
          randomUUID(),
          "ga4",
          "x",
          "y",
          futureExpiry(60),
          null,
          ACTOR,
        ]);
        throw new Error("simulated failure");
      }),
    /simulated failure/,
  );
  const rows = await query("SELECT provider FROM provider_tokens WHERE provider=$1", ["ga4"]);
  assert.equal(rows.rowCount, 0, "rolled-back insert must not persist");
});

test("owner authorization is enforced (fail-closed)", skipNoDb, async () => {
  // No session override -> requireOwner() path (throws outside Next.js request scope).
  _clearSessionOverride();
  await assert.rejects(() => storeTokens("ga4", { accessToken: "a", refreshToken: "r", expiresAt: futureExpiry(60) }, ACTOR));
  await assert.rejects(() => getValidAccessToken("ga4", ACTOR));
  await assert.rejects(() => disconnectProvider("ga4", ACTOR));
  await assert.rejects(() => getConnectionStatus("ga4", ACTOR));

  // Wrong actor -> UnauthorizedError even with a valid session.
  _setSessionOverride({ userId: ACTOR });
  await assert.rejects(() => storeTokens("ga4", { accessToken: "a", refreshToken: "r", expiresAt: futureExpiry(60) }, OTHER_ACTOR), /Authentication required/);
  await assert.rejects(() => getConnectionStatus("ga4", OTHER_ACTOR), /Authentication required/);
});

test("DB teardown", { skip: !dbAvailable }, async () => {
  _clearSessionOverride();
  _setTokenRefresh(null);
  _setTokenRevoker(null);
  await query("DELETE FROM analytics_cache");
  await query("DELETE FROM provider_tokens");
  await query("DELETE FROM oauth_states");
  await _closePool();
});
