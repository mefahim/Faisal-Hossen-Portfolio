import test from "node:test";
import assert from "node:assert/strict";
import {
  createOAuthChallenge,
  consumeOAuthState,
  verifyCodeChallenge,
  generateChallengeParts,
  OAUTH_STATE_TTL_MS,
} from "../lib/server/analytics/oauth-state";
import { query, _closePool } from "../lib/server/db";
import { generateTestEncryptionKey, isTestDatabaseAvailable, runMigrations } from "./db-test-utils";

// --- Pure crypto tests (no database required) ---

test("generateChallengeParts returns state, verifier, and challenge", () => {
  const c = generateChallengeParts();
  assert.ok(c.state.length >= 40);
  assert.ok(c.codeVerifier.length >= 40);
  assert.ok(c.codeChallenge.length >= 40);
  assert.notEqual(c.codeVerifier, c.codeChallenge);
});

test("verifier and challenge are consistent (S256)", () => {
  const c = generateChallengeParts();
  assert.equal(verifyCodeChallenge(c.codeVerifier, c.codeChallenge), true);
});

test("verifyCodeChallenge rejects wrong verifier", () => {
  const c = generateChallengeParts();
  assert.equal(verifyCodeChallenge("wrong-verifier", c.codeChallenge), false);
});

test("verifyCodeChallenge rejects empty inputs", () => {
  assert.equal(verifyCodeChallenge("", "abc"), false);
  assert.equal(verifyCodeChallenge("abc", ""), false);
});

test("each challenge has unique state and verifier", () => {
  const a = generateChallengeParts();
  const b = generateChallengeParts();
  assert.notEqual(a.state, b.state);
  assert.notEqual(a.codeVerifier, b.codeVerifier);
});

// --- Database integration tests (require DATABASE_URL) ---

const dbAvailable = isTestDatabaseAvailable();

test("DB setup: migrations and test encryption key", { skip: dbAvailable ? false : "DATABASE_URL not set" }, async () => {
  process.env.OAUTH_ENCRYPTION_KEY = generateTestEncryptionKey();
  await runMigrations(process.cwd());
  // Clean any leftover state rows from previous runs.
  await query("DELETE FROM oauth_states");
});

test("createOAuthChallenge persists state and consumeOAuthState returns verifier", { skip: !dbAvailable }, async () => {
  const c = await createOAuthChallenge("ga4");
  assert.ok(c.state.length >= 40);
  // Verifier must be stored encrypted: raw DB value must not equal plaintext.
  const rows = await query<{ encrypted_verifier: string }>("SELECT encrypted_verifier FROM oauth_states WHERE state=$1", [c.state]);
  assert.equal(rows.rowCount, 1);
  assert.notEqual(rows.rows[0].encrypted_verifier, c.codeVerifier);
  assert.ok(!rows.rows[0].encrypted_verifier.includes(c.codeVerifier));

  const consumed = await consumeOAuthState(c.state, "ga4");
  assert.equal(consumed.verifier, c.codeVerifier);
  assert.equal(consumed.ownerId, null); // no owner passed

  // Consumed: row is gone.
  const after = await query("SELECT state FROM oauth_states WHERE state=$1", [c.state]);
  assert.equal(after.rowCount, 0);
});

test("createOAuthChallenge stores ownerId and consumeOAuthState returns it", { skip: !dbAvailable }, async () => {
  const ownerId = "owner-" + Date.now();
  const c = await createOAuthChallenge("ga4", ownerId);
  const rows = await query<{ owner_id: string }>("SELECT owner_id FROM oauth_states WHERE state=$1", [c.state]);
  assert.equal(rows.rows[0].owner_id, ownerId);
  const consumed = await consumeOAuthState(c.state, "ga4");
  assert.equal(consumed.verifier, c.codeVerifier);
  assert.equal(consumed.ownerId, ownerId);
});

test("state is single-use (replay rejected)", { skip: !dbAvailable }, async () => {
  const c = await createOAuthChallenge("ga4");
  await consumeOAuthState(c.state, "ga4");
  await assert.rejects(() => consumeOAuthState(c.state, "ga4"), /Invalid or expired/);
});

test("unknown state is rejected", { skip: !dbAvailable }, async () => {
  await assert.rejects(() => consumeOAuthState("nonexistent-state-token", "ga4"), /Invalid or expired/);
});

test("expired state is rejected and purged", { skip: !dbAvailable }, async () => {
  const c = await createOAuthChallenge("ga4");
  // Backdate the expiry directly.
  await query("UPDATE oauth_states SET expires_at = DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 1 MINUTE) WHERE state=$1", [c.state]);
  await assert.rejects(() => consumeOAuthState(c.state, "ga4"), /expired/);
  // Expired row must be deleted (single-use enforcement on failure paths).
  const after = await query("SELECT state FROM oauth_states WHERE state=$1", [c.state]);
  assert.equal(after.rowCount, 0);
});

test("provider mismatch is rejected and state is consumed", { skip: !dbAvailable }, async () => {
  const c = await createOAuthChallenge("ga4");
  await assert.rejects(() => consumeOAuthState(c.state, "search_console"), /mismatch/);
  // Mismatched state is still single-use: gone after the failed attempt.
  const after = await query("SELECT state FROM oauth_states WHERE state=$1", [c.state]);
  assert.equal(after.rowCount, 0);
});

test("concurrent consumption: only one succeeds", { skip: !dbAvailable }, async () => {
  const c = await createOAuthChallenge("ga4");
  const attempts = await Promise.allSettled([
    consumeOAuthState(c.state, "ga4"),
    consumeOAuthState(c.state, "ga4"),
    consumeOAuthState(c.state, "ga4"),
  ]);
  const succeeded = attempts.filter((r) => r.status === "fulfilled");
  const failed = attempts.filter((r) => r.status === "rejected");
  assert.equal(succeeded.length, 1, "exactly one concurrent consume must succeed");
  assert.equal(failed.length, 2);
  for (const f of failed) {
    assert.match((f as PromiseRejectedResult).reason.message, /Invalid or expired/);
  }
});

test("verifier is encrypted at rest with the configured key", { skip: !dbAvailable }, async () => {
  const c = await createOAuthChallenge("ga4");
  const rows = await query<{ encrypted_verifier: string | Buffer }>(
    "SELECT encrypted_verifier FROM oauth_states WHERE state=$1",
    [c.state],
  );
  const raw = typeof rows.rows[0].encrypted_verifier === "string"
    ? rows.rows[0].encrypted_verifier
    : (rows.rows[0].encrypted_verifier as Buffer).toString("utf8");
  // AES-256-GCM wire format: base64(nonce).base64(ciphertext+tag)
  assert.match(raw, /^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
  await consumeOAuthState(c.state, "ga4"); // cleanup
});

test("decrypt failure preserves single-use (corrupted verifier)", { skip: !dbAvailable }, async () => {
  const c = await createOAuthChallenge("ga4");
  // Corrupt the stored verifier directly (simulates wrong key / tampered data).
  await query("UPDATE oauth_states SET encrypted_verifier=$1 WHERE state=$2", ["not-valid-encrypted-data", c.state]);
  await assert.rejects(() => consumeOAuthState(c.state, "ga4"), /Decryption failed|Malformed/);
  // Single-use preserved: the row must NOT be restored by a rollback.
  const after = await query("SELECT state FROM oauth_states WHERE state=$1", [c.state]);
  assert.equal(after.rowCount, 0, "state row must stay deleted after decrypt failure");
  // And it cannot be retried.
  await assert.rejects(() => consumeOAuthState(c.state, "ga4"), /Invalid or expired/);
});

test("DB teardown: clear oauth_states", { skip: !dbAvailable }, async () => {
  await query("DELETE FROM oauth_states");
  await _closePool();
});
