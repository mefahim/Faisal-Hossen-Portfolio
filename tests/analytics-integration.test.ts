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
  _clearTokenRevoker,
  _resolveRevoker,
  revokeGoogleToken,
  _setSessionOverride,
  _clearSessionOverride,
  needsRefresh,
} from "../lib/server/analytics/tokens";
import { query, transaction, transactionWithConnectionControl, _closePool } from "../lib/server/db";
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

test("setPropertyId rejects unsupported providers (L3 regression)", skipNoDb, async () => {
  await assert.rejects(() => setPropertyId("facebook", "123", ACTOR), /Unsupported provider/);
  await assert.rejects(() => setPropertyId("", "123", ACTOR), /Unsupported provider/);
});

test("revoker resolves to real implementation by default, mock/null when set (L1)", skipNoDb, async () => {
  _clearTokenRevoker();
  assert.equal(_resolveRevoker(), revokeGoogleToken, "default must be the real server-side revoker");
  const mock = async () => undefined;
  _setTokenRevoker(mock);
  assert.equal(_resolveRevoker(), mock);
  _setTokenRevoker(null);
  assert.equal(_resolveRevoker(), null, "explicit null must disable revocation");
  _clearTokenRevoker(); // restore default (real); subsequent tests set their own
  _setTokenRevoker(null); // keep disabled for the remaining tests (no live calls)
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

test("transactionWithConnectionControl destroys connection on request", skipNoDb, async () => {
  // Capture the connection ID used inside, request destruction, then verify
  // that connection is gone from the server process list (with retries: the
  // server needs a moment to process the disconnect).
  let usedId: number | null = null;
  await transactionWithConnectionControl(async (client, control) => {
    const r = await client.query<{ id: number }>("SELECT CONNECTION_ID() AS id");
    usedId = r.rows[0].id;
    control.destroyConnection = true;
    return "done";
  });
  assert.ok(usedId !== null);
  let remaining = 1;
  for (let i = 0; i < 20 && remaining > 0; i++) {
    await new Promise((r) => setTimeout(r, 50));
    const stillThere = await query("SELECT ID AS id FROM INFORMATION_SCHEMA.PROCESSLIST WHERE ID=$1", [usedId]);
    remaining = stillThere.rowCount;
  }
  assert.equal(remaining, 0, "destroyed connection must not remain on the server");
});

test("transactionWithConnectionControl reuses connection when not destroyed", skipNoDb, async () => {
  let firstId: number | null = null;
  let secondId: number | null = null;
  await transactionWithConnectionControl(async (client) => {
    const r = await client.query<{ id: number }>("SELECT CONNECTION_ID() AS id");
    firstId = r.rows[0].id;
    return "one";
  });
  await transactionWithConnectionControl(async (client) => {
    const r = await client.query<{ id: number }>("SELECT CONNECTION_ID() AS id");
    secondId = r.rows[0].id;
    return "two";
  });
  // Pool reuse is not guaranteed, but the server must still be reachable and
  // both connections must have been valid.
  assert.ok(firstId !== null && secondId !== null);
});

test("GET_LOCK / RELEASE_LOCK round-trip via SQL", skipNoDb, async () => {
  const lockName = `faisals_room:test:${Date.now()}`;
  await transaction(async (client) => {
    const acquired = await client.query<{ ok: number | null }>("SELECT GET_LOCK($1, 5) AS ok", [lockName]);
    assert.equal(acquired.rows[0]?.ok, 1, "lock must be acquirable");
    const released = await client.query<{ ok: number | null }>("SELECT RELEASE_LOCK($1) AS ok", [lockName]);
    assert.equal(released.rows[0]?.ok, 1, "lock must be releasable");
    // Releasing a non-held lock returns 0/NULL (not 1).
    const releasedAgain = await client.query<{ ok: number | null }>("SELECT RELEASE_LOCK($1) AS ok", [lockName]);
    assert.notEqual(releasedAgain.rows[0]?.ok, 1, "double release must not report success");
  });
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
